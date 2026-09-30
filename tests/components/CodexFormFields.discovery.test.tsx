import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentProps, PropsWithChildren } from "react";
import { useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CodexFormFields } from "@/components/providers/forms/CodexFormFields";
import { Form } from "@/components/ui/form";

const api = vi.hoisted(() => ({ fetch: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/api/model-fetch", () => ({
  fetchModelsForConfig: api.fetch,
  fetchXaiOauthModels: vi.fn(),
  showFetchModelsError: api.error,
}));
const FormShell = ({ children }: PropsWithChildren) => {
  const form = useForm();
  return <Form {...form}>{children}</Form>;
};
type Props = ComponentProps<typeof CodexFormFields>;
const makeProps = (): Props => ({
  appId: "codex",
  providerId: "a",
  category: "third_party",
  codexApiKey: "test-key",
  onApiKeyChange: vi.fn(),
  shouldShowApiKeyLink: false,
  websiteUrl: "",
  shouldShowSpeedTest: false,
  codexBaseUrl: "https://a.example/v1",
  onBaseUrlChange: vi.fn(),
  isFullUrl: false,
  onFullUrlChange: vi.fn(),
  isEndpointModalOpen: false,
  onEndpointModalToggle: vi.fn(),
  autoSelect: false,
  onAutoSelectChange: vi.fn(),
  codexModel: "gpt-existing",
  onModelChange: vi.fn(),
  apiFormat: "openai_responses",
  onApiFormatChange: vi.fn(),
  anthropicAuthField: "ANTHROPIC_AUTH_TOKEN",
  onAnthropicAuthFieldChange: vi.fn(),
  impersonateClaudeCode: false,
  onImpersonateClaudeCodeChange: vi.fn(),
  maxOutputTokens: "",
  onMaxOutputTokensChange: vi.fn(),
  promptCacheRouting: "auto",
  onPromptCacheRoutingChange: vi.fn(),
  catalogModels: [{ model: "manual", displayName: "My model" }],
  onCatalogModelsChange: vi.fn(),
  discoveredModels: ["gpt-existing"],
  onDiscoveredModelsChange: vi.fn(),
  speedTestEndpoints: [],
  customUserAgent: "",
  onCustomUserAgentChange: vi.fn(),
  localProxyHeadersOverride: "",
  onLocalProxyHeadersOverrideChange: vi.fn(),
  localProxyBodyOverride: "",
  onLocalProxyBodyOverrideChange: vi.fn(),
});
const clickFetch = () =>
  fireEvent.click(
    screen.getAllByRole("button", { name: "providerForm.fetchModels" })[0],
  );

describe("Codex provider model discovery", () => {
  beforeEach(() => {
    api.fetch.mockReset();
  });

  it("syncs original IDs and leaves manual metadata untouched", async () => {
    const props = makeProps();
    api.fetch.mockResolvedValue([
      { id: " gpt-6.1-sol " },
      { id: "gpt-6.1-sol" },
      { id: "" },
      { id: "bad\nname" },
    ]);
    render(
      <FormShell>
        <CodexFormFields {...props} />
      </FormShell>,
    );
    clickFetch();
    await waitFor(() =>
      expect(props.onDiscoveredModelsChange).toHaveBeenCalledWith([
        "gpt-6.1-sol",
      ]),
    );
    expect(props.onCatalogModelsChange).not.toHaveBeenCalled();
  });

  it.each([[], new Error("HTTP 503")])(
    "keeps the previous list for an empty or failed refresh (%s)",
    async (result) => {
      const props = makeProps();
      if (result instanceof Error) api.fetch.mockRejectedValue(result);
      else api.fetch.mockResolvedValue(result);
      render(
        <FormShell>
          <CodexFormFields {...props} />
        </FormShell>,
      );
      clickFetch();
      await waitFor(() =>
        expect(
          screen.getAllByRole("button", {
            name: "providerForm.fetchModels",
          })[0],
        ).toBeEnabled(),
      );
      expect(props.onDiscoveredModelsChange).not.toHaveBeenCalled();
    },
  );

  it.each(["codexBaseUrl", "codexApiKey", "providerId", "apiFormat"] as const)(
    "rejects responses from before %s changed",
    async (field) => {
      const props = makeProps();
      let resolve!: (value: { id: string }[]) => void;
      api.fetch.mockReturnValue(
        new Promise((done) => {
          resolve = done;
        }),
      );
      const view = render(
        <FormShell>
          <CodexFormFields {...props} />
        </FormShell>,
      );
      clickFetch();
      const changed = {
        ...props,
        [field]: field === "apiFormat" ? "openai_chat" : "different",
      } as Props;
      view.rerender(
        <FormShell>
          <CodexFormFields {...changed} />
        </FormShell>,
      );
      await act(async () => resolve([{ id: "stale" }]));
      expect(props.onDiscoveredModelsChange).not.toHaveBeenCalled();
    },
  );

  it("does not sync native discovery into the Chat conversion path", async () => {
    const props = { ...makeProps(), apiFormat: "openai_chat" as const };
    api.fetch.mockResolvedValue([{ id: "other" }]);
    render(
      <FormShell>
        <CodexFormFields {...props} />
      </FormShell>,
    );
    clickFetch();
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: "providerForm.fetchModels" })[0],
      ).toBeEnabled(),
    );
    expect(props.onDiscoveredModelsChange).not.toHaveBeenCalled();
  });
});
