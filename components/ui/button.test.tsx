import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";

describe("Button", () => {
  it("handles a click", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>建立教材</Button>);
    await user.click(screen.getByRole("button", { name: "建立教材" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled while loading", () => {
    render(<Button loading>送出中</Button>);
    expect(screen.getByRole("button", { name: "送出中" })).toBeDisabled();
  });
});
