import colour from "../assets/branding/cksgo-brand01-v1.1/cks-go-logo-colour.svg";
import whiteBlue from "../assets/branding/cksgo-brand01-v1.1/cks-go-logo-white-blue.svg";

export function CksGoLogo({
  variant = "colour",
  className = "",
}: {
  variant?: "colour" | "white-blue";
  className?: string;
}) {
  return (
    <img
      src={variant === "white-blue" ? whiteBlue : colour}
      alt="CKS Go"
      className={`cks-go-logo ${className}`.trim()}
      width={112}
      height={72}
    />
  );
}
