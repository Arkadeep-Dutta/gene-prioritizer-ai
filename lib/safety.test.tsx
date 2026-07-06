import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";
import { SafetyBanner } from "@/components/layout/SafetyBanner";
import { RESEARCH_DISCLAIMER } from "@/lib/safety";

describe("research safety messaging", () => {
  it("keeps the disclaimer explicit", () => {
    expect(RESEARCH_DISCLAIMER).toContain("not a medical device");
    expect(RESEARCH_DISCLAIMER).toContain("Do not enter identifiable or real patient data");
  });

  it("renders the disclaimer on the landing page", () => {
    render(
      <>
        <SafetyBanner />
        <Home />
      </>,
    );
    expect(screen.getByRole("heading", { name: "Research use only" })).toBeInTheDocument();
    expect(screen.getByText(RESEARCH_DISCLAIMER)).toBeVisible();
    expect(screen.getAllByText(/Not for diagnosis/i).length).toBeGreaterThan(0);
  });
});
