import { render, screen } from "@testing-library/react";
import { ConfigProvider, theme } from "antd";
import { describe, expect, it } from "vitest";
import { appTheme } from "./theme";

const TokenProbe = () => {
  const { token } = theme.useToken();
  return <output>{[token.colorStatusNeutral, token.colorStatusInfo, token.colorStatusSuccess, token.colorStatusMuted].join(" ")}</output>;
};

describe("тема", () => {
  it("токены статусов доступны через theme.useToken()", () => {
    render(
      <ConfigProvider theme={appTheme}>
        <TokenProbe />
      </ConfigProvider>,
    );
    expect(screen.getByRole("status").textContent?.split(" ")).toHaveLength(4);
    expect(screen.getByRole("status").textContent).not.toContain("undefined");
  });
});
