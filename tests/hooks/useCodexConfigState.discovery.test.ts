import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCodexConfigState } from "@/components/providers/forms/hooks/useCodexConfigState";

const initialData = {
  settingsConfig: {
    auth: { OPENAI_API_KEY: "test-key" },
    config:
      'model_provider = "custom"\n[model_providers.custom]\nname = "Custom"\nbase_url = "https://a.example/v1"\nwire_api = "responses"\n',
    modelCatalog: {
      models: [{ model: "manual" }],
      discoveredModels: ["gpt-6.1-sol"],
    },
  },
};

describe("provider discovery persistence", () => {
  it("loads the saved list and preserves it when only the default model changes", () => {
    const { result } = renderHook(() => useCodexConfigState({ initialData }));
    expect(result.current.codexDiscoveredModels).toEqual(["gpt-6.1-sol"]);
    act(() => result.current.handleCodexModelChange("gpt-6.1-sol"));
    expect(result.current.codexDiscoveredModels).toEqual(["gpt-6.1-sol"]);
  });

  it.each(["key", "url", "raw", "auth"])(
    "invalidates discovery on %s edits while keeping manual rows",
    (kind) => {
      const { result } = renderHook(() => useCodexConfigState({ initialData }));
      act(() => {
        if (kind === "key")
          result.current.handleCodexApiKeyChange("another-key");
        if (kind === "url")
          result.current.handleCodexBaseUrlChange("https://b.example/v1");
        if (kind === "raw")
          result.current.handleCodexConfigChange(
            initialData.settingsConfig.config.replace("a.example", "b.example"),
          );
        if (kind === "auth")
          result.current.setCodexAuth('{"OPENAI_API_KEY":"another-key"}');
      });
      expect(result.current.codexDiscoveredModels).toEqual([]);
      expect(result.current.codexCatalogModels[0].model).toBe("manual");
    },
  );

  it("switches initial provider data without leaking or losing discovered models", () => {
    const { result, rerender } = renderHook(
      ({ data }) => useCodexConfigState({ initialData: data }),
      { initialProps: { data: initialData } },
    );
    const other = {
      settingsConfig: {
        ...initialData.settingsConfig,
        config: initialData.settingsConfig.config.replace(
          "a.example",
          "b.example",
        ),
        modelCatalog: { models: [], discoveredModels: ["b-model"] },
      },
    };
    rerender({ data: other });
    expect(result.current.codexDiscoveredModels).toEqual(["b-model"]);
    act(() => result.current.resetCodexConfig({}, ""));
    expect(result.current.codexDiscoveredModels).toEqual([]);
  });
});
