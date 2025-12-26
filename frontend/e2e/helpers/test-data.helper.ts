export interface TestUser {
  accountName: string;
  email: string;
  password: string;
}

export interface TestProperty {
  name: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface TestExpense {
  amount: string;
  date?: Date;
  category: string;
  description?: string;
}

export interface TestIncome {
  amount: string;
  date?: Date;
  source?: string;
  description?: string;
}

// IRS Schedule E expense categories
const EXPENSE_CATEGORIES = [
  'Advertising',
  'Auto and Travel',
  'Cleaning and Maintenance',
  'Commissions',
  'Insurance',
  'Legal and Professional Fees',
  'Management Fees',
  'Mortgage Interest',
  'Other Interest',
  'Repairs',
  'Supplies',
  'Taxes',
  'Utilities',
  'Depreciation',
  'Other',
];

export class TestDataHelper {
  static generateTestUser(): TestUser {
    const timestamp = Date.now();
    return {
      accountName: `Test Account ${timestamp}`,
      email: `test-${timestamp}@example.com`,
      password: 'TestPassword123!',
    };
  }

  static generateProperty(): TestProperty {
    const timestamp = Date.now();
    return {
      name: `Test Property ${timestamp}`,
      street: `${Math.floor(Math.random() * 9999)} Test Street`,
      city: 'Austin',
      state: 'Texas', // Use full state name to match dropdown options
      zipCode: '78701',
    };
  }

  /**
   * Generate test expense data with unique timestamp-based description
   */
  static generateExpense(options?: Partial<TestExpense>): TestExpense {
    const timestamp = Date.now();
    const randomAmount = (Math.random() * 500 + 50).toFixed(2);
    const randomCategory = EXPENSE_CATEGORIES[Math.floor(Math.random() * EXPENSE_CATEGORIES.length)];

    return {
      amount: options?.amount ?? randomAmount,
      date: options?.date ?? new Date(),
      category: options?.category ?? randomCategory,
      description: options?.description ?? `E2E Test Expense ${timestamp}`,
    };
  }

  /**
   * Generate test income data with unique timestamp-based source
   */
  static generateIncome(options?: Partial<TestIncome>): TestIncome {
    const timestamp = Date.now();
    const randomAmount = (Math.random() * 2000 + 500).toFixed(2);

    return {
      amount: options?.amount ?? randomAmount,
      date: options?.date ?? new Date(),
      source: options?.source ?? `Tenant ${timestamp}`,
      description: options?.description ?? `E2E Test Income ${timestamp}`,
    };
  }

  /**
   * Generate a date in the past (for testing date ranges)
   */
  static generatePastDate(daysAgo: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date;
  }

  /**
   * Get a specific expense category
   */
  static getExpenseCategory(index: number): string {
    return EXPENSE_CATEGORIES[index % EXPENSE_CATEGORIES.length];
  }
}
