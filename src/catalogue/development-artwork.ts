// Original, unbranded illustrations for the local development catalogue only.
// This module is reached through the development adapter's DEV-only import.
const image = (markup: string) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markup)}`;

// HTTPS-shaped fixture URLs preserve the strict catalogue contract. The local
// renderer resolves these exact development URLs before the browser fetches.
export const developmentAppleUrl =
  "https://cks-go-development.invalid/artwork/apple.svg";
export const developmentRiceUrl =
  "https://cks-go-development.invalid/artwork/rice.svg";

export const appleArtworkUrl =
  image(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">
<defs><radialGradient id="red" cx="34%" cy="24%" r="76%"><stop stop-color="#f77c74"/><stop offset=".46" stop-color="#dd2931"/><stop offset="1" stop-color="#a51020"/></radialGradient><radialGradient id="gold" cx="32%" cy="24%" r="80%"><stop stop-color="#fff5ce"/><stop offset="1" stop-color="#e9c77f"/></radialGradient></defs>
<ellipse cx="161" cy="266" rx="105" ry="16" fill="#d9e2dd" opacity=".55"/>
<path d="M177 91c-17-33-34-40-50-36 17 11 26 25 31 42" fill="#5a3b2f"/>
<path d="M170 74c10-32 38-41 66-33-13 29-36 43-66 33Z" fill="#34804c"/><path d="M171 72c15-13 32-20 52-24" fill="none" stroke="#8cc993" stroke-width="3"/>
<path d="M159 101c-36-23-91-10-109 32-17 41 4 108 39 126 22 12 41 3 64 3 25 0 40 11 65-4 37-23 61-88 42-127-21-41-68-53-101-30Z" fill="url(#red)" stroke="#a91b29" stroke-width="3"/>
<path d="M91 125c-26 28-27 66-13 94" fill="none" stroke="#ffd8d4" stroke-linecap="round" stroke-width="14" opacity=".5"/>
<path d="M133 161c-29-10-62 0-71 26-11 30 15 59 44 66 25 6 54-6 70-20-1-34-16-59-43-72Z" fill="url(#gold)" stroke="#d7ae69" stroke-width="3"/><path d="M115 173c15 14 29 33 42 56" fill="none" stroke="#c78c55" stroke-width="3" opacity=".65"/>
</svg>`);

export const riceArtworkUrl =
  image(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">
<defs><linearGradient id="bag" x2="1" y2="1"><stop stop-color="#f7e7bc"/><stop offset="1" stop-color="#dbbd86"/></linearGradient></defs>
<ellipse cx="160" cy="271" rx="104" ry="14" fill="#d9e2dd" opacity=".6"/>
<path d="M97 94h126l15 157c-35 17-117 20-156 0Z" fill="url(#bag)" stroke="#bd9b68" stroke-width="3"/>
<path d="M97 94c9-14 25-22 63-22s54 8 63 22c-28 12-97 14-126 0Z" fill="#e9d19d" stroke="#bd9b68" stroke-width="3"/>
<path d="M88 187c43 15 102 15 144 0l5 52c-42 16-107 18-152 0Z" fill="#f4ead3" opacity=".9"/>
<path d="M104 104c39 10 77 10 112 0" fill="none" stroke="#fff4d5" stroke-width="4"/>
<g fill="#fff9e8" stroke="#ceb580" stroke-width="1.5"><ellipse cx="123" cy="194" rx="6" ry="14" transform="rotate(-25 123 194)"/><ellipse cx="145" cy="208" rx="6" ry="14" transform="rotate(18 145 208)"/><ellipse cx="169" cy="192" rx="6" ry="14" transform="rotate(-12 169 192)"/><ellipse cx="192" cy="207" rx="6" ry="14" transform="rotate(25 192 207)"/></g>
<path d="M112 70c-10-16-18-27-33-32M207 71c12-18 22-25 39-27" fill="none" stroke="#c4a873" stroke-width="4" stroke-linecap="round"/>
</svg>`);

export const groceryBannerArtworkUrl =
  image(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 300" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="ground" x2="1" y2="1"><stop stop-color="#fff7f1"/><stop offset="1" stop-color="#ffe5d6"/></linearGradient><radialGradient id="apple"><stop stop-color="#f56a62"/><stop offset="1" stop-color="#d61d2c"/></radialGradient></defs>
<rect width="720" height="300" fill="url(#ground)"/><circle cx="642" cy="45" r="122" fill="#ffd8c5" opacity=".55"/>
<ellipse cx="570" cy="252" rx="135" ry="22" fill="#cda99b" opacity=".24"/>
<path d="M490 132h158l-20 125H511Z" fill="#d8a77e" stroke="#b97854" stroke-width="5"/><path d="M502 162h135M508 192h125M513 222h116" stroke="#bb805e" stroke-width="5"/>
<path d="M514 143c-26-43-12-82 22-89 18 33 12 64-22 89Z" fill="#4e9b63"/><path d="M541 145c-4-53 20-83 52-83 7 41-7 67-52 83Z" fill="#287a4d"/><path d="M570 144c19-48 44-66 75-56-4 36-26 56-75 56Z" fill="#6ba954"/>
<circle cx="522" cy="137" r="35" fill="url(#apple)"/><circle cx="568" cy="129" r="39" fill="#ef903b"/><circle cx="614" cy="148" r="35" fill="url(#apple)"/>
<path d="M518 99c8-13 16-14 28-9M607 108c8-14 16-14 28-9" fill="none" stroke="#34834e" stroke-width="8" stroke-linecap="round"/>
<path d="M449 171c-22-21-37-38-37-66 39 11 61 40 37 66Z" fill="#67a96d"/><path d="M455 184c-27-13-46-16-64-8 21 25 44 35 64 8Z" fill="#388b55"/>
</svg>`);

export function developmentArtworkFor(url: string | null): string | null {
  if (url === developmentAppleUrl) return appleArtworkUrl;
  if (url === developmentRiceUrl) return riceArtworkUrl;
  return null;
}
