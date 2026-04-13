import { render, screen } from "@testing-library/react";
import { Avatar, AvatarGroup } from "@/components/ui/Avatar";

describe("Avatar", () => {
  it("닉네임 이니셜을 렌더링한다", () => {
    render(<Avatar nickname="김민준" size="md" />);
    expect(screen.getByText("김")).toBeInTheDocument();
  });

  it("size에 따라 올바른 클래스를 가진다", () => {
    const { container } = render(<Avatar nickname="이서연" size="sm" />);
    expect(container.firstChild).toHaveClass("w-8");
  });
});

describe("AvatarGroup", () => {
  const users = [
    { id: "u1", nickname: "A" },
    { id: "u2", nickname: "B" },
    { id: "u3", nickname: "C" },
    { id: "u4", nickname: "D" },
    { id: "u5", nickname: "E" },
  ];

  it("5명 중 4개 + '+1' 배지를 렌더링한다", () => {
    render(<AvatarGroup users={users} />);
    expect(screen.getByText("+1")).toBeInTheDocument();
  });
});
