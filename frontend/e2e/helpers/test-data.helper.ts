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
      state: 'TX',
      zipCode: '78701',
    };
  }
}
