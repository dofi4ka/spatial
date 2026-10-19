declare global {
	namespace App {
		interface Locals {
			user: import('#lib/types.ts').User | null;
		}
	}
}
export {};
