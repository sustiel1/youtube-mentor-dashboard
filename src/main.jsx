import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { ensureKnowledgeLibraryVaultFiles } from "@/lib/knowledgeLibrary";

ensureKnowledgeLibraryVaultFiles();

createRoot(document.getElementById("root")).render(<App />);
