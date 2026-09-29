const image = (markup: string) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markup)}`;

export const cksGroceryBannerArtworkUrl = image(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 300" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="ground" x2="1" y2="1"><stop stop-color="#fff7f1"/><stop offset="1" stop-color="#ffe5d6"/></linearGradient><radialGradient id="apple"><stop stop-color="#f56a62"/><stop offset="1" stop-color="#d61d2c"/></radialGradient></defs>
<rect width="720" height="300" fill="url(#ground)"/><circle cx="642" cy="45" r="122" fill="#ffd8c5" opacity=".55"/>
<ellipse cx="570" cy="252" rx="135" ry="22" fill="#cda99b" opacity=".24"/>
<path d="M490 132h158l-20 125H511Z" fill="#d8a77e" stroke="#b97854" stroke-width="5"/><path d="M502 162h135M508 192h125M513 222h116" stroke="#bb805e" stroke-width="5"/>
<path d="M514 143c-26-43-12-82 22-89 18 33 12 64-22 89Z" fill="#4e9b63"/><path d="M541 145c-4-53 20-83 52-83 7 41-7 67-52 83Z" fill="#287a4d"/><path d="M570 144c19-48 44-66 75-56-4 36-26 56-75 56Z" fill="#6ba954"/>
<circle cx="522" cy="137" r="35" fill="url(#apple)"/><circle cx="568" cy="129" r="39" fill="#ef903b"/><circle cx="614" cy="148" r="35" fill="url(#apple)"/>
<path d="M518 99c8-13 16-14 28-9M607 108c8-14 16-14 28-9" fill="none" stroke="#34834e" stroke-width="8" stroke-linecap="round"/>
<path d="M449 171c-22-21-37-38-37-66 39 11 61 40 37 66Z" fill="#67a96d"/><path d="M455 184c-27-13-46-16-64-8 21 25 44 35 64 8Z" fill="#388b55"/>
</svg>`,
);
