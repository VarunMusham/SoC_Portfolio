// Documentation source for every IP block on the SoC map.
//
// The content below is PLACEHOLDER text that shows the structure. Replace the
// values with your real datasheet content. Register offsets, reset values and
// signal lists are illustrative and must be checked against your RTL/spec.

export type RegisterRow = {
  name: string;
  offset: string;
  access: 'RW' | 'RO' | 'WO' | 'W1C';
  reset: string;
  description: string;
};

export type SignalRow = {
  name: string;
  direction: 'in' | 'out' | 'inout';
  description: string;
};

export type IpDoc = {
  slug: string;
  name: string;
  fullName: string;
  summary: string;
  version: string;
  overview: string[];
  features: string[];
  registers: RegisterRow[];
  signals: SignalRow[];
  programming: string[];
};

export const ips: IpDoc[] = [
  {
    slug: 'spi',
    name: 'SPI',
    fullName: 'Serial Peripheral Interface',
    summary: 'Full-duplex synchronous serial link for flash, sensors and displays.',
    version: 'r2p1',
    overview: [
      'The SPI controller drives a four-wire synchronous bus (SCLK, MOSI, MISO and chip select) in master mode. It can also run as a slave.',
      'The bus clock is derived from the peripheral clock through a programmable divider. All four clock polarity and phase modes are supported.',
    ],
    features: [
      'Master and slave operation',
      'Four chip-select lines',
      'TX and RX FIFOs with threshold interrupts',
      'All four CPOL/CPHA modes',
    ],
    registers: [
      { name: 'CTRL', offset: '0x00', access: 'RW', reset: '0x00000000', description: 'Mode, clock divider, chip select and enable bits' },
      { name: 'STATUS', offset: '0x04', access: 'RO', reset: '0x00000002', description: 'FIFO levels and busy flag' },
      { name: 'TXD', offset: '0x08', access: 'WO', reset: '0x00000000', description: 'Transmit FIFO port' },
      { name: 'RXD', offset: '0x0C', access: 'RO', reset: '0x00000000', description: 'Receive FIFO port' },
    ],
    signals: [
      { name: 'sclk', direction: 'out', description: 'Serial clock' },
      { name: 'mosi', direction: 'out', description: 'Master out, slave in' },
      { name: 'miso', direction: 'in', description: 'Master in, slave out' },
      { name: 'ss_n[3:0]', direction: 'out', description: 'Active-low chip select lines' },
    ],
    programming: [
      'Set master mode and the clock divider in CTRL.',
      'Select the target chip-select line.',
      'Write bytes to TXD while STATUS reports the TX FIFO is not full.',
      'Read RXD once the busy flag clears.',
    ],
  },
  {
    slug: 'i2c',
    name: 'I2C',
    fullName: 'Inter-Integrated Circuit',
    summary: 'Two-wire bus for sensors, EEPROMs and power management chips.',
    version: 'r1p3',
    overview: [
      'The I2C controller implements a two-wire multi-master bus. It handles start and stop conditions, acknowledgement and arbitration in hardware.',
      'Software sees a byte-oriented register interface, so each transfer is a short sequence of register writes.',
    ],
    features: [
      'Standard (100 kHz) and fast (400 kHz) modes',
      '7-bit and 10-bit addressing',
      'Clock stretching support',
      'Multi-master arbitration',
    ],
    registers: [
      { name: 'CTRL', offset: '0x00', access: 'RW', reset: '0x00000000', description: 'Enable, master and direction control' },
      { name: 'STATUS', offset: '0x04', access: 'RO', reset: '0x00000000', description: 'Busy, arbitration lost and ACK received' },
      { name: 'ADDR', offset: '0x08', access: 'RW', reset: '0x00000000', description: 'Target address and R/W bit' },
      { name: 'DATA', offset: '0x0C', access: 'RW', reset: '0x00000000', description: 'Transmit and receive data byte' },
      { name: 'CLK_DIV', offset: '0x10', access: 'RW', reset: '0x00000000', description: 'Bus clock divider' },
    ],
    signals: [
      { name: 'scl', direction: 'inout', description: 'Serial clock line (open drain)' },
      { name: 'sda', direction: 'inout', description: 'Serial data line (open drain)' },
      { name: 'irq', direction: 'out', description: 'Transfer complete or error interrupt' },
    ],
    programming: [
      'Write CLK_DIV for the target bus rate.',
      'Write the target address and R/W bit to ADDR.',
      'Write data bytes to DATA and start the transfer from CTRL.',
      'Check STATUS for ACK before sending the next byte.',
    ],
  },
  {
    slug: 'uart',
    name: 'UART',
    fullName: 'Universal Asynchronous Receiver/Transmitter',
    summary: 'Full-duplex serial port for consoles and debug links.',
    version: 'r3p0',
    overview: [
      'The UART provides a full-duplex asynchronous serial port with a programmable baud rate. It is typically used as a debug console or a host link.',
      'Hardware FIFOs buffer incoming and outgoing bytes so that software does not have to service every character.',
    ],
    features: [
      'Programmable baud rate from the reference clock',
      '8-bit data with optional parity',
      '1 or 2 stop bits',
      '64-byte TX and RX FIFOs',
      'RX timeout interrupt',
    ],
    registers: [
      { name: 'CTRL', offset: '0x00', access: 'RW', reset: '0x00000000', description: 'Frame format, TX and RX enable' },
      { name: 'STATUS', offset: '0x04', access: 'RO', reset: '0x00000010', description: 'FIFO empty and full flags' },
      { name: 'BAUD_GEN', offset: '0x08', access: 'RW', reset: '0x00000000', description: 'Baud rate divider' },
      { name: 'TXD', offset: '0x0C', access: 'WO', reset: '0x00000000', description: 'Transmit FIFO port' },
      { name: 'RXD', offset: '0x10', access: 'RO', reset: '0x00000000', description: 'Receive FIFO port' },
    ],
    signals: [
      { name: 'txd', direction: 'out', description: 'Transmit data' },
      { name: 'rxd', direction: 'in', description: 'Receive data' },
      { name: 'cts_n', direction: 'in', description: 'Clear to send (active low)' },
      { name: 'rts_n', direction: 'out', description: 'Request to send (active low)' },
    ],
    programming: [
      'Program the baud divider for the target rate.',
      'Set the frame format in CTRL.',
      'Enable TX and RX.',
      'Poll STATUS for TX space, then write each byte to TXD.',
    ],
  },
  {
    slug: 'gpio',
    name: 'GPIO',
    fullName: 'General-Purpose I/O',
    summary: 'Bank of 32 pins, each configurable as an input or output.',
    version: 'r2p0',
    overview: [
      'The GPIO bank exposes 32 pins. Each pin can be set as an input or an output, and can raise an interrupt on an edge or a level.',
      'Set and clear registers update single pins without a read-modify-write cycle, which keeps shared pins safe across tasks.',
    ],
    features: [
      '32 pins per bank',
      'Per-pin direction control',
      'Per-pin edge and level interrupts',
      'Atomic set and clear registers',
    ],
    registers: [
      { name: 'DIR', offset: '0x00', access: 'RW', reset: '0x00000000', description: '1 = output, 0 = input' },
      { name: 'OUT', offset: '0x04', access: 'RW', reset: '0x00000000', description: 'Output value per pin' },
      { name: 'IN', offset: '0x08', access: 'RO', reset: 'pin state', description: 'Sampled pin value' },
      { name: 'INT_EDGE', offset: '0x0C', access: 'RW', reset: '0x00000000', description: 'Edge (1) or level (0) interrupt select' },
      { name: 'INT_STAT', offset: '0x10', access: 'W1C', reset: '0x00000000', description: 'Pending interrupt flags, cleared by writing 1' },
    ],
    signals: [
      { name: 'gpio[31:0]', direction: 'inout', description: 'Bank pins' },
      { name: 'irq', direction: 'out', description: 'Combined interrupt for enabled pins' },
    ],
    programming: [
      'Set the direction bits in DIR.',
      'Write output values through OUT, or use the set and clear ports.',
      'Read IN to sample input pins.',
      'Clear INT_STAT by writing 1 to the pending bits.',
    ],
  },
  {
    slug: 'ttc',
    name: 'TTC',
    fullName: 'Triple Timer Counter',
    summary: 'Three 16-bit timers for intervals, match events and capture.',
    version: 'r1p2',
    overview: [
      'The TTC block contains three independent 16-bit counters. Each counter can run in interval mode, raise match events, or capture an input edge.',
      'Typical uses are periodic tick generation, PWM-style waveforms and measuring the period of an external signal.',
    ],
    features: [
      'Three independent counters',
      'Interval mode with automatic reload',
      'Two match comparators per counter',
      'Input capture on edge',
      'Selectable prescaler',
    ],
    registers: [
      { name: 'CLK_CTRL', offset: '0x00', access: 'RW', reset: '0x00000000', description: 'Prescaler and clock source' },
      { name: 'INTERVAL', offset: '0x04', access: 'RW', reset: '0x00000000', description: 'Reload value for interval mode' },
      { name: 'MATCH1', offset: '0x08', access: 'RW', reset: '0x00000000', description: 'First match comparator' },
      { name: 'CNT_CTRL', offset: '0x0C', access: 'RW', reset: '0x00000001', description: 'Counter enable, mode and reset' },
      { name: 'ISR', offset: '0x54', access: 'W1C', reset: '0x00000000', description: 'Interrupt status, cleared by writing 1' },
    ],
    signals: [
      { name: 'clk_in', direction: 'in', description: 'External clock or capture input' },
      { name: 'wave_out[2:0]', direction: 'out', description: 'Waveform output per counter' },
      { name: 'irq', direction: 'out', description: 'Interval or match interrupt' },
    ],
    programming: [
      'Set the prescaler in CLK_CTRL.',
      'Write the reload value to INTERVAL.',
      'Enable the counter in CNT_CTRL.',
      'Service the interrupt and clear ISR.',
    ],
  },
  {
    slug: 'wdt',
    name: 'WDT',
    fullName: 'Watchdog Timer',
    summary: 'Resets the system when software stops servicing it in time.',
    version: 'r1p0',
    overview: [
      'The watchdog counts down from a programmed timeout. Software must restart it before the timeout expires, or the block asserts a reset.',
      'A lock bit stops accidental changes to the timeout, so a runaway task cannot disable the watchdog silently.',
    ],
    features: [
      'Windowed restart',
      'Two-stage operation: interrupt, then reset',
      'Register lock to prevent accidental changes',
    ],
    registers: [
      { name: 'CTRL', offset: '0x00', access: 'RW', reset: '0x00000000', description: 'Enable and reset-on-timeout bits' },
      { name: 'RESTART', offset: '0x04', access: 'WO', reset: '0x00000000', description: 'Restart the countdown' },
      { name: 'COUNT', offset: '0x08', access: 'RO', reset: '0x00000000', description: 'Current countdown value' },
      { name: 'TIMEOUT', offset: '0x0C', access: 'RW', reset: '0x00000000', description: 'Timeout period' },
    ],
    signals: [
      { name: 'clk', direction: 'in', description: 'Watchdog clock' },
      { name: 'wdt_rst_n', direction: 'out', description: 'System reset request (active low)' },
      { name: 'irq', direction: 'out', description: 'Pre-timeout interrupt' },
    ],
    programming: [
      'Write the timeout to TIMEOUT.',
      'Enable the watchdog in CTRL.',
      'Write RESTART before the countdown reaches zero.',
    ],
  },
  {
    slug: 'dma',
    name: 'DMA',
    fullName: 'Direct Memory Access Controller',
    summary: 'Moves blocks of data between memory and peripherals without the CPU.',
    version: 'r2p2',
    overview: [
      'The DMA controller runs up to eight channels. Each channel copies a block from a source to a destination, so the CPU can do other work during the transfer.',
      'Transfers can be chained with descriptors, which lets a long copy run as a sequence of short blocks.',
    ],
    features: [
      'Eight channels',
      'Linked descriptors for scatter-gather transfers',
      'Burst sizes of 1, 4 and 8 words',
      'Completion and error interrupts',
    ],
    registers: [
      { name: 'GLOBAL_CTRL', offset: '0x000', access: 'RW', reset: '0x00000000', description: 'Global enable and reset' },
      { name: 'CH_SRC', offset: '0x100 + n*0x20', access: 'RW', reset: '0x00000000', description: 'Source address for channel n' },
      { name: 'CH_DST', offset: '0x104 + n*0x20', access: 'RW', reset: '0x00000000', description: 'Destination address for channel n' },
      { name: 'CH_LEN', offset: '0x108 + n*0x20', access: 'RW', reset: '0x00000000', description: 'Transfer length in words' },
      { name: 'CH_CTRL', offset: '0x10C + n*0x20', access: 'RW', reset: '0x00000000', description: 'Burst size, direction and start' },
    ],
    signals: [
      { name: 'dma_req[7:0]', direction: 'in', description: 'Peripheral request per channel' },
      { name: 'dma_ack[7:0]', direction: 'out', description: 'Acknowledge per channel' },
      { name: 'bus_m', direction: 'inout', description: 'Bus master port for memory access' },
      { name: 'irq', direction: 'out', description: 'Completion or error interrupt' },
    ],
    programming: [
      'Write source, destination and length for the channel.',
      'Set the burst size and direction in CH_CTRL.',
      'Enable the global block and start the channel.',
      'Wait for the completion interrupt.',
    ],
  },
  {
    slug: 'can',
    name: 'CAN',
    fullName: 'Controller Area Network',
    summary: 'Message-based bus controller for automotive and industrial control.',
    version: 'r1p1',
    overview: [
      'The CAN controller sends and receives frames on a shared differential bus. Arbitration is handled in hardware, so the highest-priority frame wins without corruption.',
      'Acceptance filters let software receive only the message IDs it needs.',
    ],
    features: [
      'CAN 2.0A and 2.0B frames',
      '32 message buffers',
      'Acceptance filtering',
      'Error counters with automatic bus-off recovery',
    ],
    registers: [
      { name: 'MODE', offset: '0x00', access: 'RW', reset: '0x00000001', description: 'Reset, normal and loopback modes' },
      { name: 'BIT_TIMING', offset: '0x04', access: 'RW', reset: '0x00000000', description: 'Bit rate and sample point' },
      { name: 'STATUS', offset: '0x08', access: 'RO', reset: '0x00000000', description: 'Bus state and error flags' },
      { name: 'TX_BUF', offset: '0x0C', access: 'RW', reset: '0x00000000', description: 'Transmit buffer and request' },
      { name: 'RX_BUF', offset: '0x10', access: 'RO', reset: '0x00000000', description: 'Receive buffer' },
    ],
    signals: [
      { name: 'can_tx', direction: 'out', description: 'Transceiver transmit' },
      { name: 'can_rx', direction: 'in', description: 'Transceiver receive' },
      { name: 'irq', direction: 'out', description: 'Receive, transmit or error interrupt' },
    ],
    programming: [
      'Configure BIT_TIMING for the bus speed.',
      'Set normal mode in MODE.',
      'Load a frame into TX_BUF and request transmission.',
      'Read RX_BUF on a receive interrupt.',
    ],
  },
];

export function findIp(slug: string | undefined): IpDoc | undefined {
  return ips.find((ip) => ip.slug === slug);
}
