// Test-only, content-free instrumentation. No owner proof, transport or audio access.
(() => {
	const proto = WebGL2RenderingContext.prototype,
		original = {};
	const contexts = new WeakMap(),
		states = [],
		names = new WeakMap();
	const api = {
		mode: "actual",
		strength: 0.7,
		reduced: false,
		phase: "startup",
		frames: [],
		begin(label) {
			this.phase = label;
			this.frames = [];
			for (const s of states) s.gpu = [];
		},
		report() {
			for (const s of states) poll(s);
			const f = this.frames,
				intervals = f.slice(1).map((x, i) => x.t - f[i].t);
			const stats = (values) => {
				const v = [...values].sort((a, b) => a - b);
				return {
					median: v[Math.floor(v.length * 0.5)] ?? null,
					p95: v[Math.ceil(v.length * 0.95) - 1] ?? null,
				};
			};
			const canvas = document.querySelector("[data-sam-renderer] canvas");
			return {
				phase: this.phase,
				mode: this.mode,
				frames: f.length,
				drawIntervalsMs: stats(intervals),
				cpuSubmissionMs: stats(f.map((x) => x.cpu)),
				gpuMs: stats(states.flatMap((s) => s.gpu)),
				gpuSamples: states.reduce((n, s) => n + s.gpu.length, 0),
				gapsOver100Ms: intervals.filter((x) => x > 100).length,
				tierLights: [...new Set(f.map((x) => x.tier))],
				viewport: [innerWidth, innerHeight, devicePixelRatio],
				backing: canvas ? [canvas.width, canvas.height] : null,
				renderer: document.querySelector("[data-sam-renderer]")?.dataset
					.samRenderer,
				heapBytes: performance.memory?.usedJSHeapSize ?? null,
				bufferBytes: states.reduce(
					(n, s) => n + [...s.buffers.values()].reduce((a, b) => a + b, 0),
					0,
				),
				firstField: f[0]?.field,
				lastField: f.at(-1)?.field,
				actualVoice: [...new Set(f.map((x) => x.actualVoice))],
				timerDisjoint: states.some((s) => s.disjoint),
			};
		},
	};
	window.samVisualProbe = api;
	function state(gl) {
		let s = contexts.get(gl);
		if (!s) {
			s = {
				gl,
				ext: gl.getExtension("EXT_disjoint_timer_query_webgl2"),
				queries: [],
				gpu: [],
				buffers: new Map(),
				bound: new Map(),
				serial: 0,
				start: 0,
				tier: 0,
				field: [],
				disjoint: false,
			};
			contexts.set(gl, s);
			states.push(s);
		}
		return s;
	}
	function poll(s) {
		if (!s.ext) return;
		s.disjoint = Boolean(s.gl.getParameter(s.ext.GPU_DISJOINT_EXT));
		s.queries = s.queries.filter((item) => {
			const q = item.q;
			if (!s.gl.getQueryParameter(q, s.gl.QUERY_RESULT_AVAILABLE)) return true;
			if (item.phase === api.phase && !s.disjoint && s.gpu.length < 128)
				s.gpu.push(s.gl.getQueryParameter(q, s.gl.QUERY_RESULT) / 1e6);
			s.gl.deleteQuery(q);
			return false;
		});
	}
	for (const name of [
		"getUniformLocation",
		"uniform1f",
		"uniform1i",
		"uniform4f",
		"bindBuffer",
		"bufferData",
		"deleteBuffer",
		"clear",
		"drawArrays",
	])
		original[name] = proto[name];
	proto.getUniformLocation = function (p, n) {
		const v = original.getUniformLocation.call(this, p, n);
		if (v) names.set(v, n);
		return v;
	};
	proto.bindBuffer = function (t, b) {
		state(this).bound.set(t, b);
		return original.bindBuffer.call(this, t, b);
	};
	proto.bufferData = function (t, data, ...rest) {
		const s = state(this),
			b = s.bound.get(t);
		if (b)
			s.buffers.set(
				b,
				typeof data === "number" ? data : (data?.byteLength ?? 0),
			);
		return original.bufferData.call(this, t, data, ...rest);
	};
	proto.deleteBuffer = function (b) {
		state(this).buffers.delete(b);
		return original.deleteBuffer.call(this, b);
	};
	proto.uniform1i = function (l, v) {
		if (names.get(l) === "u_light_count") state(this).tier = v;
		return original.uniform1i.call(this, l, v);
	};
	const pulse = () =>
		api.reduced
			? 0
			: Math.max(0, api.strength) *
				(0.18 + 0.52 * Math.max(0, Math.sin(performance.now() * 0.014)));
	proto.uniform4f = function (l, x, y, z, w) {
		const n = names.get(l),
			s = state(this);
		if (n === "u_field_state") s.field = [x, y, z, w];
		if (n === "u_behavior") {
			s.actualVoice = Boolean(x || y);
			if (api.mode !== "actual") {
				const p = s.pulse ?? 0;
				x = api.mode === "listening" ? p * 0.5 : 0;
				y = api.mode === "speaking" ? p : 0;
				z = 0;
				w = api.mode === "listening" ? 1 : 0;
			}
		}
		return original.uniform4f.call(this, l, x, y, z, w);
	};
	proto.uniform1f = function (l, v) {
		if (api.mode !== "actual") {
			const p = state(this).pulse ?? 0,
				n = names.get(l),
				out = api.mode === "speaking" ? p : 0,
				input = api.mode === "listening" ? p * 0.5 : 0;
			if (n === "u_radius")
				v = api.mode === "speaking" ? 1.03 + 0.14 * out : 1 - 0.035 * input;
			if (n === "u_peel_lift") v = 0.002 + 0.055 * out + 0.045 * input;
			if (n === "u_highlight") v = 0.28 * out;
			if (n === "u_spread") v = 0.16 * out + 0.04 * input;
			if (n === "u_opacity_boost") v = 0.32 * out + 0.08 * input;
			if (n === "u_excitation") v = 0.4 * out + 0.12 * input;
		}
		return original.uniform1f.call(this, l, v);
	};
	proto.clear = function (mask) {
		const s = state(this);
		if (mask === (this.COLOR_BUFFER_BIT | this.DEPTH_BUFFER_BIT)) {
			if (s.active) {
				this.endQuery(s.ext.TIME_ELAPSED_EXT);
				this.deleteQuery(s.active);
				s.active = null;
			}
			poll(s);
			s.start = performance.now();
			s.pulse = pulse();
			s.serial++;
			if (s.ext && s.serial % 12 === 0 && s.queries.length < 16) {
				s.active = this.createQuery();
				this.beginQuery(s.ext.TIME_ELAPSED_EXT, s.active);
			}
		}
		return original.clear.call(this, mask);
	};
	proto.drawArrays = function (mode, ...rest) {
		const s = state(this),
			result = original.drawArrays.call(this, mode, ...rest);
		if (mode === this.POINTS && s.start) {
			const now = performance.now();
			if (s.active) {
				this.endQuery(s.ext.TIME_ELAPSED_EXT);
				s.queries.push({ q: s.active, phase: api.phase });
				s.active = null;
			}
			if (api.frames.length < 3000)
				api.frames.push({
					t: s.start,
					cpu: now - s.start,
					tier: s.tier,
					field: [...s.field],
					actualVoice: s.actualVoice,
				});
			s.start = 0;
		}
		return result;
	};
})();
