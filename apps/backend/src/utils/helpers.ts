export function generateRoomCode(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return code;
}

export function getRandomFragment(): string {
  const fragments = ["AR", "BO", "CA", "DE", "EX", "FO", "GR", "HI", "JU"];
  return fragments[Math.floor(Math.random() * fragments.length)];
}
