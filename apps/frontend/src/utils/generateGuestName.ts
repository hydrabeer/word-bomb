export function generateGuestName(): string {
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `Guest${randomDigits}`;
}