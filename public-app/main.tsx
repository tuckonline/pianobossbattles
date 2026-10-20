import "../src/app/globals.css";
import { createRoot } from "react-dom/client";
import { PublicApp } from "./home";
createRoot(document.getElementById("root")!).render(<PublicApp/>);
