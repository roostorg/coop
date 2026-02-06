// Solution from https://stackoverflow.com/questions/10992921/how-to-remove-emoji-code-using-javascript
export function stripEmojis(input: string) {
  return input.replace(
    /(?![*#0-9]+)[\p{Emoji}\p{Emoji_Modifier}\p{Emoji_Component}\p{Emoji_Modifier_Base}\p{Emoji_Presentation}]/gu,
    '',
  );
}

export function replaceEmptyStringWithNull(input: string | null | undefined) {
  return input === '' ? null : input;
}
