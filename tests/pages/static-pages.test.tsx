import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AboutPage from "@/app/about/page";
import AdminDataPage, { metadata as adminMetadata } from "@/app/admin/data/page";
import DataSourcesPage from "@/app/data-sources/page";
import DisclaimerPage from "@/app/disclaimer/page";
import HomePage from "@/app/page";
import MethodologyPage from "@/app/methodology/page";
import PrivacyPage from "@/app/privacy/page";
import robots from "@/app/robots";
import SecurityPage from "@/app/security/page";

vi.mock("@/components/workflow/GenePrioritizerWorkflow", () => ({
  GenePrioritizerWorkflow: () => <div>Workflow fixture</div>,
}));

describe("informational pages", () => {
  it("renders homepage hero and workflow", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: /gene prioritizer ai/i })).toBeInTheDocument();
    expect(screen.getByText(/Workflow fixture/i)).toBeInTheDocument();
    expect(screen.getByText(/not a diagnostic tool/i)).toBeInTheDocument();
  });

  it("renders about page", () => {
    render(<AboutPage />);
    expect(screen.getByRole("heading", { name: /about gene prioritizer ai/i })).toBeInTheDocument();
    expect(screen.getByText(/not a diagnosis/i)).toBeInTheDocument();
  });

  it("renders methodology page", () => {
    render(<MethodologyPage />);
    expect(screen.getByRole("heading", { name: /methodology/i })).toBeInTheDocument();
    expect(screen.getByText(/deterministic HPO-to-gene scoring/i)).toBeInTheDocument();
  });

  it("renders data sources page", () => {
    render(<DataSourcesPage />);
    expect(screen.getByRole("heading", { name: /data sources/i })).toBeInTheDocument();
    expect(screen.getByText(/does not scrape GeneCards/i)).toBeInTheDocument();
  });

  it("renders disclaimer page", () => {
    render(<DisclaimerPage />);
    expect(screen.getByRole("heading", { name: /disclaimer/i })).toBeInTheDocument();
    expect(screen.getByText(/Not a diagnosis/i)).toBeInTheDocument();
  });

  it("renders privacy page", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { name: /privacy/i })).toBeInTheDocument();
    expect(screen.getByText(/Raw free text is not stored by default/i)).toBeInTheDocument();
  });

  it("renders security page", () => {
    render(<SecurityPage />);
    expect(screen.getByRole("heading", { name: /security/i })).toBeInTheDocument();
    expect(screen.getByText(/No hardcoded secrets/i)).toBeInTheDocument();
  });

  it("renders noindex admin data page and robots protections", () => {
    render(<AdminDataPage />);
    expect(screen.getByRole("heading", { name: /admin data status/i })).toBeInTheDocument();
    expect(adminMetadata.robots).toEqual({ index: false, follow: false });
    expect(robots().rules).toEqual([{ userAgent: "*", disallow: ["/api/", "/admin/"] }]);
  });
});
