import { BadRequestException } from "@nestjs/common";

export function normalizeMailboxLocalPart(value: string | undefined) {
  const localPart = value?.trim().toLowerCase();

  if (
    !localPart ||
    localPart.length > 64 ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    !/^(?:[a-z0-9]|[a-z0-9][a-z0-9._-]*[a-z0-9])$/.test(localPart) ||
    /[;&|`$()<>\\\s]/.test(localPart)
  ) {
    throw new BadRequestException("A valid mailbox local part is required.");
  }

  return localPart;
}
