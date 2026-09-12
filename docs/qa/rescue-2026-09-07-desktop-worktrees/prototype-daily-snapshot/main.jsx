import React, { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { DailySnapshot } from "./DailySnapshot.jsx";
import { defaultPresentationState, presentationStates } from "./dailySnapshot.fixture.js";
import "./styles.css";

function PrototypeApp() {
  const [stateKey, setStateKey] = useState(defaultPresentationState);
  const selectedState = presentationStates.find((state) => state.key === stateKey);

  return (
    <DailySnapshot
      key={stateKey}
      snapshot={selectedState.snapshot}
      presentation={{
        title: "מצב תצוגה",
        helper: "בחירת מצב משנה נתוני הדגמה בלבד ואינה נשמרת.",
        activeKey: stateKey,
        options: presentationStates.map(({ key, label }) => ({ key, label })),
        onChange: setStateKey,
      }}
    />
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PrototypeApp />
  </StrictMode>,
);
