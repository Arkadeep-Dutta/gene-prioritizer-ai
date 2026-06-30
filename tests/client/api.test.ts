import { afterEach, describe, expect, it, vi } from "vitest";

import { getHpoTerm, requestJson } from "@/lib/client/api";

describe("client API helper", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok envelopes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true, data: { value: 1 }, warnings: [] }), {
          status: 200,
        }),
      ),
    );

    await expect(requestJson<{ value: number }>("/api/test")).resolves.toMatchObject({
      data: { value: 1 },
    });
  });

  it("handles error envelopes without exposing stack traces", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: false,
            data: {},
            warnings: ["Safe warning"],
            error: { code: "BAD_INPUT", message: "Safe validation message." },
          }),
          { status: 400 },
        ),
      ),
    );

    await expect(requestJson("/api/test")).rejects.toMatchObject({
      message: "Safe validation message.",
      code: "BAD_INPUT",
      status: 400,
      warnings: ["Safe warning"],
    });
  });

  it("handles network errors safely", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("stack trace should not leak")));

    await expect(requestJson("/api/test")).rejects.toMatchObject({
      message: "Network request failed. Please try again.",
      code: "NETWORK_ERROR",
    });
  });

  it("looks up HPO terms through the local API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { hpoId: "HP:0001250", label: "Seizure" },
          warnings: [],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getHpoTerm("HP:0001250")).resolves.toMatchObject({
      data: { hpoId: "HP:0001250", label: "Seizure" },
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/hpo/term/HP%3A0001250", expect.any(Object));
  });
});
