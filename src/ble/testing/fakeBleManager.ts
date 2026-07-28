import { State } from './blePlxStub';

type StateListener = (state: State) => void;
type ScanListener = (error: Error | null, device: FakeDevice | null) => void;
type MonitorListener = (error: Error | null, characteristic: { value: string } | null) => void;

/**
 * Hand-driven stand-in for ble-plx's `Device`. Tests advertise, connect and
 * push characteristic notifications explicitly — no jest.mock anywhere, per
 * the repo's #11 convention.
 */
export class FakeDevice {
  discoverCalls = 0;
  /** Set to reject so a test can kill a connection between connect and discover. */
  discoverImpl: () => Promise<void> = async () => {};
  private monitorListener: MonitorListener | null = null;

  constructor(
    public id: string,
    public name: string | null = 'Forerunner',
    public localName: string | null = null,
    public rssi: number | null = -60,
  ) {}

  async discoverAllServicesAndCharacteristics(): Promise<FakeDevice> {
    this.discoverCalls += 1;
    await this.discoverImpl();
    return this;
  }

  monitorCharacteristicForService(_service: string, _char: string, listener: MonitorListener) {
    this.monitorListener = listener;
    return { remove: () => (this.monitorListener = null) };
  }

  /** Push a raw Heart Rate Measurement payload as the sensor would. */
  notify(bytes: number[]): void {
    this.monitorListener?.(null, { value: Buffer.from(bytes).toString('base64') });
  }

  notifyError(message: string): void {
    this.monitorListener?.(new Error(message), null);
  }

  get monitoring(): boolean {
    return this.monitorListener !== null;
  }
}

export interface ConnectCall {
  deviceId: string;
  options: unknown;
}

/**
 * Hand-driven stand-in for ble-plx's `BleManager`, covering exactly the six
 * methods BleHeartRateMonitor uses. Tests drive the radio, the scan results
 * and the connection outcome directly.
 */
export class FakeBleManager {
  scanning = false;
  stopScanCalls = 0;
  cancelledConnections: string[] = [];
  /** Every connectToDevice call, so tests can assert the #134 options shape. */
  connectCalls: ConnectCall[] = [];
  /** Swap to reject, to simulate a failing connect attempt. */
  connectImpl: (deviceId: string) => Promise<FakeDevice> = async (deviceId) =>
    new FakeDevice(deviceId);

  private stateListeners = new Set<StateListener>();
  private scanListener: ScanListener | null = null;
  private disconnectListeners = new Map<string, () => void>();

  onStateChange(listener: StateListener, emitCurrentState?: boolean) {
    this.stateListeners.add(listener);
    // ble-plx replays the current state when asked. Tests drive states
    // explicitly instead, so nothing is emitted here — but the flag is
    // recorded because passing it is load-bearing (#118: the listener must be
    // armed for the whole session, not just the first transition).
    if (emitCurrentState) this.emitCurrentStateRequested = true;
    return { remove: () => this.stateListeners.delete(listener) };
  }

  emitCurrentStateRequested = false;

  startDeviceScan(_uuids: string[] | null, _options: unknown, listener: ScanListener) {
    this.scanning = true;
    this.scanListener = listener;
  }

  stopDeviceScan(): void {
    this.scanning = false;
    this.stopScanCalls += 1;
    this.scanListener = null;
  }

  async connectToDevice(deviceId: string, options: unknown): Promise<FakeDevice> {
    this.connectCalls.push({ deviceId, options });
    return this.connectImpl(deviceId);
  }

  async cancelDeviceConnection(deviceId: string): Promise<void> {
    this.cancelledConnections.push(deviceId);
  }

  onDeviceDisconnected(deviceId: string, listener: () => void) {
    this.disconnectListeners.set(deviceId, listener);
    return { remove: () => this.disconnectListeners.delete(deviceId) };
  }

  // ---- test drivers ----

  /** Flip the Bluetooth adapter state. */
  emitState(state: State): void {
    [...this.stateListeners].forEach((listener) => listener(state));
  }

  get stateListenerCount(): number {
    return this.stateListeners.size;
  }

  /** Report a discovered peripheral to the active scan. */
  discover(device: FakeDevice): void {
    this.scanListener?.(null, device);
  }

  /** Fail the active scan the way ble-plx does. */
  failScan(message: string): void {
    this.scanListener?.(new Error(message), null);
  }

  /** Drop the link for a connected device. */
  disconnect(deviceId: string): void {
    this.disconnectListeners.get(deviceId)?.();
  }

  get hasDisconnectListener(): boolean {
    return this.disconnectListeners.size > 0;
  }
}

/** Fake of the AppStateReader seam #150 introduced. */
export class FakeAppState {
  constructor(private active = true) {}
  isActive = () => this.active;
  set(active: boolean): void {
    this.active = active;
  }
}
