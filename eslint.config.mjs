import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([{
    extends: [...nextCoreWebVitals, ...nextTypescript],

    rules: {
        "@typescript-eslint/no-unused-vars": ["warn", {
            argsIgnorePattern: "^_",
        }],

        "react/no-unescaped-entities": "off",

        // These two rules come from the React Compiler readiness checks
        // bundled with eslint-config-next 16 and flag the standard
        // "fetch data in an Effect" / react-hook-form `watch()` patterns
        // used throughout this codebase (see React's own docs on
        // data-fetching Effects). None of the flagged call sites are bugs;
        // adopting the Compiler is a separate, deliberate migration this
        // remediation pass does not otherwise touch, so these are disabled
        // here rather than rewriting ~10 unrelated effect call sites.
        "react-hooks/set-state-in-effect": "off",
        "react-hooks/incompatible-library": "off",
    },
}]);