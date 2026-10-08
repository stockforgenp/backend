import bcrypt from "bcryptjs";
import { ClientDocument } from "../types";

interface StoredClient {
  client: ClientDocument;
  passwordHash: string;
}

class MockStorageService {
  private clients = new Map<string, StoredClient>();

  async createClient(
    client: ClientDocument,
    plainPassword: string,
  ): Promise<ClientDocument> {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(plainPassword, salt);
    this.clients.set(client.id, { client: { ...client }, passwordHash });
    return client;
  }

  async getClientById(id: string): Promise<ClientDocument | null> {
    const record = this.clients.get(id);
    return record ? { ...record.client } : null;
  }

  async getClientByEmail(email: string): Promise<ClientDocument | null> {
    for (const record of this.clients.values()) {
      if (record.client.email.toLowerCase() === email.toLowerCase()) {
        return { ...record.client };
      }
    }
    return null;
  }

  async verifyPassword(
    email: string,
    plainPassword: string,
  ): Promise<ClientDocument | null> {
    for (const record of this.clients.values()) {
      if (record.client.email.toLowerCase() === email.toLowerCase()) {
        const matches = await bcrypt.compare(
          plainPassword,
          record.passwordHash,
        );
        if (matches) {
          return { ...record.client };
        }
        return null;
      }
    }
    return null;
  }

  async updateClient(
    id: string,
    updates: Partial<ClientDocument>,
  ): Promise<ClientDocument | null> {
    const record = this.clients.get(id);
    if (!record) return null;

    record.client = {
      ...record.client,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.clients.set(id, record);
    return { ...record.client };
  }

  async deleteClient(id: string): Promise<boolean> {
    return this.clients.delete(id);
  }

  async listClients(filter?: {
    search?: string;
    status?: string;
    plan?: string;
    limit?: number;
    page?: number;
  }): Promise<{ clients: ClientDocument[]; total: number }> {
    let list = Array.from(this.clients.values()).map((r) => ({ ...r.client }));

    if (filter?.status) {
      list = list.filter((c) => c.subscription.status === filter.status);
    }
    if (filter?.plan) {
      list = list.filter((c) => c.subscription.plan === filter.plan);
    }
    if (filter?.search) {
      const search = filter.search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.email.toLowerCase().includes(search) ||
          (c.shopName && c.shopName.toLowerCase().includes(search)),
      );
    }

    const total = list.length;
    const page = filter?.page || 1;
    const limit = filter?.limit || 20;
    const offset = (page - 1) * limit;
    const paginated = list.slice(offset, offset + limit);

    return { clients: paginated, total };
  }
}

export const mockStorage = new MockStorageService();
