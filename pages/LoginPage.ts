// Import Playwright's types for typing and the shared BasePage class
import { Page, Locator } from '@playwright/test';
import BasePage from './BasePage';

// LoginPage encapsulates interactions with the login page
export default class LoginPage extends BasePage {
	// Create a new LoginPage instance using the Playwright page
	constructor(page: Page) {
		super(page);
	}

	// Locator helper for the username input field
	private usernameField(): Locator {
		return this.page.getByRole('textbox', { name: 'Username' });
	}

	// Locator helper for the password input field
	private passwordField(): Locator {
		return this.page.getByRole('textbox', { name: 'Password' });
	}

	// Locator helper for the login button
	private loginButton(): Locator {
		return this.page.getByRole('button', { name: /Login/ });
	}

	// Locator for the notification flash message shown after an action
	flashLocator(): Locator {
		return this.page.locator('#flash');
	}

	// Open the login page using the BasePage's goto helper
	async goto(): Promise<void> {
		await super.goto('https://the-internet.herokuapp.com/login');
	}

	// Fill the username input with the provided value
	async fillUsername(username: string): Promise<void> {
		await this.usernameField().fill(username);
	}

	// Fill the password input with the provided value
	async fillPassword(password: string): Promise<void> {
		await this.passwordField().fill(password);
	}

	// Click the login button to submit the form
	async clickLogin(): Promise<void> {
		await this.loginButton().click();
	}

	// Perform full login flow: set username, set password, click login
	async login(username: string, password: string): Promise<void> {
		await this.fillUsername(username);
		await this.fillPassword(password);
		await this.clickLogin();
	}
}
