export function calculateAgeAt(birthDate: Date | string | null | undefined, at: Date | string = new Date()) {
  if (!birthDate) return null;

  const birth = getDateParts(birthDate);
  const reference = getDateParts(at);

  if (!birth || !reference) return null;

  let age = reference.year - birth.year;
  const monthDelta = reference.month - birth.month;
  const beforeBirthday = monthDelta < 0 || (monthDelta === 0 && reference.day < birth.day);
  if (beforeBirthday) age -= 1;

  return age;
}

export function isAdultAt(birthDate: Date | string | null | undefined, at: Date | string = new Date(), minAge = 18) {
  const age = calculateAgeAt(birthDate, at);
  return age !== null && age >= minAge;
}

function getDateParts(value: Date | string) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return { year: value.getFullYear(), month: value.getMonth() + 1, day: value.getDate() };
  }

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return { year: Number(dateOnly[1]), month: Number(dateOnly[2]), day: Number(dateOnly[3]) };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}
