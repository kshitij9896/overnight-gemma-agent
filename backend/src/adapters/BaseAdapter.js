class BaseAdapter {
  constructor(onMessageCallback) {
    this.onMessage = onMessageCallback;
    this.status = 'DISCONNECTED';
    this.groups = [];
  }

  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  async sendSelfDM(text) {
    throw new Error('sendSelfDM() must be implemented by subclass');
  }

  async getGroups() {
    return this.groups;
  }

  getAuthPayload() {
    return { status: this.status };
  }
}

module.exports = BaseAdapter;