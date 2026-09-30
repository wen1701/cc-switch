import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { ProviderForm } from "@/components/providers/forms/ProviderForm";
import { createTestQueryClient } from "../utils/testQueryClient";

vi.mock("@/components/providers/forms/CodexConfigEditor", () => ({
  default: () => null,
}));
vi.mock("@/components/providers/forms/ProviderAdvancedConfig", () => ({
  ProviderAdvancedConfig: () => null,
}));
vi.mock("@/components/providers/forms/hooks", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/components/providers/forms/hooks")
  >()),
  useCopilotAuth: () => ({ isAuthenticated: false, accounts: [] }),
  useCodexOauth: () => ({ isAuthenticated: false, accounts: [] }),
  useXaiOauth: () => ({ isAuthenticated: false, accounts: [] }),
}));

vi.mock("@/lib/api/model-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/model-fetch")>()),
  fetchModelsForConfig: vi
    .fn()
    .mockResolvedValue([{ id: "gpt-6.1-sol", ownedBy: null }]),
}));

it("saves discovered models with their provider and reloads them without manual mapping", async () => {
  const onSubmit = vi.fn();
  const initialData = {
    name: "Test Relay",
    category: "third_party" as const,
    settingsConfig: {
      auth: { OPENAI_API_KEY: "test-key" },
      config:
        'model = "gpt-6.1-sol"\nmodel_provider = "custom"\n[model_providers.custom]\nname = "Test"\nbase_url = "https://example.test/v1"\nwire_api = "responses"\n',
      modelCatalog: {
        models: [{ model: "manual", displayName: "Keep me" }],
        discoveredModels: ["old-model"],
      },
    },
  };
  const shell = (data: typeof initialData) => (
    <QueryClientProvider client={createTestQueryClient()}>
      <ProviderForm
        appId="codex"
        submitLabel="Save"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        initialData={data}
      />
    </QueryClientProvider>
  );
  const view = render(shell(initialData));
  fireEvent.click(
    screen.getAllByRole("button", { name: "providerForm.fetchModels" })[0],
  );
  await waitFor(() =>
    expect(
      screen.getAllByRole("button", { name: "providerForm.fetchModels" })[0],
    ).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  const settings = JSON.parse(onSubmit.mock.calls[0][0].settingsConfig);
  expect(settings.modelCatalog).toEqual({
    models: [{ model: "manual", displayName: "Keep me" }],
    discoveredModels: ["gpt-6.1-sol"],
  });
  view.unmount();
  render(shell({ ...initialData, settingsConfig: settings }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
  expect(
    JSON.parse(onSubmit.mock.calls[1][0].settingsConfig).modelCatalog,
  ).toEqual(settings.modelCatalog);
});
