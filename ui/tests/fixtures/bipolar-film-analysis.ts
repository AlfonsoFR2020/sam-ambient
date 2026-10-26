import { bipolarFilmPoint, createBipolarFilmGeometry } from "../../src/visual-engine/bipolar-film";
import { bipolarCoordinates, createBipolarPeels } from "../../src/visual-engine/bipolar-peel";
export const BIPOLAR_FILM_API = {
  createBipolarPeels,
  bipolarCoordinates,
  createBipolarGeometry: createBipolarFilmGeometry,
  bipolarPeelPoint: bipolarFilmPoint,
};
