type TFn = (key: string, opts?: Record<string, unknown>) => string;
export declare function ubDateParts(today?: Date | number): [number, number, number];
export declare function ageFromBirthDate(birthDate: unknown, today?: Date | number): number | null;
export declare function formatAge(n: number, t: TFn): string;
export declare function stripAgeFromBio(bio: unknown): string;
export declare function bioMentionsAge(bio: unknown): boolean;
export declare function ageBioLine(child: { birthDate?: string; bio?: string } | null | undefined, t: TFn, today?: Date | number): string;
