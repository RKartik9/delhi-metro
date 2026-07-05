import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: ["scripts/**", "public/**", ".next/**", "node_modules/**"],
  },
];

export default eslintConfig;
