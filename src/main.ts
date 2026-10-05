import "./style.css";
import { loadSettings } from "./game/stats";
import { startApp } from "./ui/app";

try {
  document.documentElement.dataset.theme = loadSettings(window.localStorage).theme;
} catch {
  /* storage unavailable: keep the default dark theme */
}

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app element");
startApp(root);
