import asyncio
from unittest.mock import AsyncMock

import pytest

from sam_ambient.core.tools.browser import PublicEgress, navigation_target
from sam_ambient.core.tools.models import ToolError


@pytest.mark.parametrize(
    "url",
    [
        "file:///C:/secret",
        "javascript:alert(1)",
        "data:text/plain,x",
        "http://example.com/",
        "https://a:b@example.com/",
        "https://example.com:8765/",
        "https://example.com\\@localhost/",
        "https://example.com/\nsecret",
    ],
)
def test_invalid_browser_routes_rejected(url):
    with pytest.raises(ToolError):
        navigation_target(url)


@pytest.mark.parametrize(
    "address",
    [
        "127.0.0.1",
        "192.168.1.1",
        "10.0.0.1",
        "169.254.169.254",
        "::1",
        "::ffff:127.0.0.1",
        "224.0.0.1",
    ],
)
def test_dns_resolution_to_private_addresses_fails_closed(address, monkeypatch):
    async def run():
        loop = asyncio.get_running_loop()
        monkeypatch.setattr(
            loop, "getaddrinfo", AsyncMock(return_value=[(0, 0, 0, "", (address, 443))])
        )
        with pytest.raises(ToolError, match="blocked"):
            await PublicEgress().destination("https://public-looking.test/")

    asyncio.run(run())


def test_proxy_requires_its_private_credential_and_closes_cleanly():
    async def run():
        proxy = PublicEgress()
        settings = await proxy.start()
        port = int(settings["server"].rsplit(":", 1)[1])
        reader, writer = await asyncio.open_connection("127.0.0.1", port)
        writer.write(b"CONNECT example.com:443 HTTP/1.1\r\nHost: example.com\r\n\r\n")
        await writer.drain()
        assert (await reader.read()).startswith(b"HTTP/1.1 407")
        writer.close()
        await writer.wait_closed()
        await proxy.close()
        await proxy.close()
        assert not proxy._tasks

    asyncio.run(run())
