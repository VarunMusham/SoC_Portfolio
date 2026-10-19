// Documentation source for every IP block in the system-level block design.
//
// The array order is the order of the blocks on the APB bus, left to right. The diagram
// alternates them between its two rows, so neighbours in this list sit in different rows.
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
    slug: 'uart',
    name: 'UART',
    fullName: 'Universal Asynchronous Receiver/Transmitter',
    summary: 'Asynchronous serial port for consoles, modems and debug links.',
    version: 'r1p3',
    overview: [
      'The UART converts bytes to and from an asynchronous serial stream. It frames each byte with a start bit, optional parity and one or two stop bits.',
      'Transmit and receive FIFOs decouple the software from the line rate. A fractional baud generator derives the bit clock from the peripheral clock.',
    ],
    features: [
      '5 to 8 data bits, optional parity, 1 or 2 stop bits',
      '16-byte TX and RX FIFOs with programmable thresholds',
      'Fractional baud-rate divider',
      'Break detection and framing, parity and overrun error flags',
    ],
    registers: [
      { name: 'CTRL', offset: '0x00', access: 'RW', reset: '0x00000000', description: 'Enable, frame format and loopback' },
      { name: 'BAUD', offset: '0x04', access: 'RW', reset: '0x0000028B', description: 'Integer and fractional baud divider' },
      { name: 'STATUS', offset: '0x08', access: 'RO', reset: '0x00000005', description: 'FIFO flags and line errors' },
      { name: 'DATA', offset: '0x0C', access: 'RW', reset: '0x00000000', description: 'Write to transmit, read to receive' },
    ],
    signals: [
      { name: 'txd', direction: 'out', description: 'Serial transmit' },
      { name: 'rxd', direction: 'in', description: 'Serial receive' },
      { name: 'rts_n', direction: 'out', description: 'Request to send, active low' },
      { name: 'cts_n', direction: 'in', description: 'Clear to send, active low' },
      { name: 'irq', direction: 'out', description: 'FIFO threshold or error interrupt' },
    ],
    programming: [
      'Program BAUD for the required rate.',
      'Set the frame format and enable the block in CTRL.',
      'Write bytes to DATA while STATUS shows the TX FIFO is not full.',
      'Read DATA on a receive interrupt, then check STATUS for line errors.',
    ],
  },
  {
    slug: 'i2c',
    name: 'I2C',
    fullName: 'Inter-Integrated Circuit Controller',
    summary: 'Two-wire multi-drop bus for sensors, EEPROMs and PMICs.',
    version: 'r2p0',
    overview: [
      'The I2C controller drives a two-wire open-drain bus (SCL and SDA) as a master or responds to an address as a slave.',
      'It handles start, repeated start and stop conditions, 7-bit and 10-bit addressing, clock stretching and arbitration loss in hardware.',
    ],
    features: [
      'Master and slave operation',
      'Standard, fast and fast-plus speed modes',
      '7-bit and 10-bit addressing',
      'Clock stretching and multi-master arbitration',
    ],
    registers: [
      { name: 'CTRL', offset: '0x00', access: 'RW', reset: '0x00000000', description: 'Enable, mode and speed select' },
      { name: 'TARGET', offset: '0x04', access: 'RW', reset: '0x00000000', description: 'Target address and direction' },
      { name: 'STATUS', offset: '0x08', access: 'RO', reset: '0x00000001', description: 'Bus busy, ACK and arbitration flags' },
      { name: 'DATA', offset: '0x0C', access: 'RW', reset: '0x00000000', description: 'Transmit and receive FIFO port' },
    ],
    signals: [
      { name: 'scl', direction: 'inout', description: 'Serial clock, open drain' },
      { name: 'sda', direction: 'inout', description: 'Serial data, open drain' },
      { name: 'irq', direction: 'out', description: 'Transfer complete, NACK or arbitration interrupt' },
    ],
    programming: [
      'Select the speed mode and clock divider in CTRL.',
      'Write the target address and direction to TARGET.',
      'Push bytes into DATA for a write, or read DATA after the transfer for a read.',
      'Check STATUS for a NACK or lost arbitration before the next transfer.',
    ],
  },
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
      { name: 'cs_n[3:0]', direction: 'out', description: 'Chip selects, active low' },
      { name: 'irq', direction: 'out', description: 'FIFO threshold interrupt' },
    ],
    programming: [
      'Set master mode, CPOL/CPHA and the clock divider in CTRL.',
      'Assert a chip select.',
      'Write bytes to TXD. Each one clocks a byte into RXD.',
      'Drain RXD, then release the chip select.',
    ],
  },
  {
    slug: 'i2s',
    name: 'I2S',
    fullName: 'Inter-IC Sound Interface',
    summary: 'Serial digital audio link for codecs, microphones and amplifiers.',
    version: 'r1p1',
    overview: [
      'The I2S block streams stereo or multichannel PCM audio over a three-wire link: bit clock, word select and serial data.',
      'It can generate the bit and word clocks as a master or follow them as a slave. Separate transmit and receive paths run independently.',
    ],
    features: [
      'Master and slave clocking',
      '16, 24 and 32-bit samples',
      'Philips I2S, left-justified and right-justified formats',
      'TX and RX FIFOs with DMA request outputs',
    ],
    registers: [
      { name: 'CTRL', offset: '0x00', access: 'RW', reset: '0x00000000', description: 'Enable, format and master or slave select' },
      { name: 'CLKDIV', offset: '0x04', access: 'RW', reset: '0x00000004', description: 'Bit clock and word clock dividers' },
      { name: 'STATUS', offset: '0x08', access: 'RO', reset: '0x00000000', description: 'FIFO levels and underrun or overrun flags' },
      { name: 'TXD', offset: '0x0C', access: 'WO', reset: '0x00000000', description: 'Transmit sample FIFO port' },
      { name: 'RXD', offset: '0x10', access: 'RO', reset: '0x00000000', description: 'Receive sample FIFO port' },
    ],
    signals: [
      { name: 'bclk', direction: 'inout', description: 'Bit clock' },
      { name: 'lrclk', direction: 'inout', description: 'Word select (left/right clock)' },
      { name: 'sd_out', direction: 'out', description: 'Serial data to the codec' },
      { name: 'sd_in', direction: 'in', description: 'Serial data from the codec' },
      { name: 'mclk', direction: 'out', description: 'Optional master clock' },
    ],
    programming: [
      'Set the sample size and format in CTRL.',
      'Program CLKDIV for the sample rate.',
      'Prefill the TX FIFO to avoid an immediate underrun.',
      'Enable the block, then keep the FIFOs serviced.',
    ],
  },
  {
    slug: 'xspi',
    name: 'xSPI',
    fullName: 'Extended SPI Memory Controller',
    summary: 'Octal and dual-data-rate serial link for high-speed external flash and RAM.',
    version: 'r1p0',
    overview: [
      'The xSPI controller drives eight-bit-wide serial memories using the JEDEC extended SPI protocol, with command, address and data phases.',
      'It supports double-data-rate transfers and a memory-mapped read window, so software can execute from flash in place.',
    ],
    features: [
      'Octal data lanes, with a data strobe',
      'Single and double data rate',
      'Memory-mapped read mode for execute-in-place',
      'Programmable command, address and dummy-cycle lengths',
    ],
    registers: [
      { name: 'CTRL', offset: '0x00', access: 'RW', reset: '0x00000000', description: 'Enable, DDR and memory-mapped mode' },
      { name: 'CMD', offset: '0x04', access: 'RW', reset: '0x00000000', description: 'Opcode and phase configuration' },
      { name: 'ADDR', offset: '0x08', access: 'RW', reset: '0x00000000', description: 'Transfer address' },
      { name: 'STATUS', offset: '0x0C', access: 'RO', reset: '0x00000001', description: 'Busy and error flags' },
      { name: 'DATA', offset: '0x10', access: 'RW', reset: '0x00000000', description: 'Indirect-mode data port' },
    ],
    signals: [
      { name: 'sclk', direction: 'out', description: 'Serial clock' },
      { name: 'cs_n', direction: 'out', description: 'Chip select, active low' },
      { name: 'io[7:0]', direction: 'inout', description: 'Octal data lanes' },
      { name: 'dqs', direction: 'inout', description: 'Data strobe' },
      { name: 'irq', direction: 'out', description: 'Transfer complete or error interrupt' },
    ],
    programming: [
      'Configure the clock divider and DDR mode in CTRL.',
      'Describe the command in CMD and the target in ADDR.',
      'For indirect access, move data through DATA and poll STATUS.',
      'For execute-in-place, enable memory-mapped mode and read from the window.',
    ],
  },
  {
    slug: 'qspi',
    name: 'QSPI',
    fullName: 'Quad SPI Flash Controller',
    summary: 'Four-lane serial link for NOR flash boot and storage.',
    version: 'r2p0',
    overview: [
      'The QSPI controller reads and programs serial NOR flash over one, two or four data lanes.',
      'A linear read window maps the flash into the address space for boot and execute-in-place. An indirect mode handles erase and program.',
    ],
    features: [
      'Single, dual and quad data lanes',
      'Linear memory-mapped read window',
      'Indirect read and write with a FIFO',
      'Two flash devices on separate chip selects',
    ],
    registers: [
      { name: 'CTRL', offset: '0x00', access: 'RW', reset: '0x00000000', description: 'Enable, lane width and clock divider' },
      { name: 'INSTR', offset: '0x04', access: 'RW', reset: '0x0000000B', description: 'Read opcode and dummy cycles' },
      { name: 'STATUS', offset: '0x08', access: 'RO', reset: '0x00000001', description: 'Busy and FIFO flags' },
      { name: 'DATA', offset: '0x0C', access: 'RW', reset: '0x00000000', description: 'Indirect-mode data FIFO' },
    ],
    signals: [
      { name: 'sclk', direction: 'out', description: 'Serial clock' },
      { name: 'cs_n[1:0]', direction: 'out', description: 'Chip selects, active low' },
      { name: 'io[3:0]', direction: 'inout', description: 'Quad data lanes' },
      { name: 'irq', direction: 'out', description: 'Transfer complete interrupt' },
    ],
    programming: [
      'Set the lane width and clock divider in CTRL.',
      'Program INSTR with the read opcode and dummy cycles.',
      'Enable the linear window and read the flash directly.',
      'Use indirect mode through DATA for erase and program commands.',
    ],
  },
  {
    slug: 'pwm',
    name: 'PWM',
    fullName: 'Pulse-Width Modulator',
    summary: 'Multi-channel timer outputs for motors, LEDs and power stages.',
    version: 'r1p2',
    overview: [
      'The PWM block generates periodic pulses whose width is set in software. Each channel compares a shared counter against its own duty value.',
      'Edge-aligned and centre-aligned counting are supported. Dead-time insertion protects half-bridge drivers.',
    ],
    features: [
      'Four channels sharing one period counter',
      'Edge-aligned and centre-aligned modes',
      'Programmable polarity and dead time',
      'Shadow registers for glitch-free updates',
    ],
    registers: [
      { name: 'CTRL', offset: '0x00', access: 'RW', reset: '0x00000000', description: 'Enable, alignment and prescaler' },
      { name: 'PERIOD', offset: '0x04', access: 'RW', reset: '0x0000FFFF', description: 'Counter period' },
      { name: 'DUTY[n]', offset: '0x10 + n*0x04', access: 'RW', reset: '0x00000000', description: 'Duty compare value for channel n' },
      { name: 'DEADTIME', offset: '0x20', access: 'RW', reset: '0x00000000', description: 'Dead-time between complementary outputs' },
    ],
    signals: [
      { name: 'pwm_out[3:0]', direction: 'out', description: 'Channel outputs' },
      { name: 'pwm_outn[3:0]', direction: 'out', description: 'Complementary channel outputs' },
      { name: 'fault', direction: 'in', description: 'Emergency shutdown input' },
      { name: 'irq', direction: 'out', description: 'Period or fault interrupt' },
    ],
    programming: [
      'Set the prescaler and alignment mode in CTRL.',
      'Write PERIOD, then the DUTY value for each channel.',
      'Set DEADTIME for complementary outputs.',
      'Enable the block. Later DUTY writes take effect at the next period.',
    ],
  },
  {
    slug: 'rtc',
    name: 'RTC',
    fullName: 'Real-Time Clock',
    summary: 'Battery-backed calendar and alarm that keeps time while the SoC sleeps.',
    version: 'r1p1',
    overview: [
      'The RTC counts seconds from a 32.768 kHz crystal and exposes the time as a calendar. It sits in an always-on domain, so it keeps running when the rest of the SoC is off.',
      'One alarm can raise an interrupt or wake the system from a low-power state.',
    ],
    features: [
      '32.768 kHz oscillator input',
      'Calendar from seconds to years',
      'Programmable alarm with wake-up output',
      'Trim register for crystal calibration',
    ],
    registers: [
      { name: 'CTRL', offset: '0x00', access: 'RW', reset: '0x00000000', description: 'Enable and alarm interrupt enable' },
      { name: 'TIME', offset: '0x04', access: 'RW', reset: '0x00000000', description: 'Hours, minutes and seconds' },
      { name: 'DATE', offset: '0x08', access: 'RW', reset: '0x00000001', description: 'Year, month and day' },
      { name: 'ALARM', offset: '0x0C', access: 'RW', reset: '0x00000000', description: 'Alarm time match' },
      { name: 'STATUS', offset: '0x10', access: 'W1C', reset: '0x00000000', description: 'Alarm flag' },
    ],
    signals: [
      { name: 'xtal_in', direction: 'in', description: '32.768 kHz clock' },
      { name: 'wake', direction: 'out', description: 'Wake-up request to the power controller' },
      { name: 'irq', direction: 'out', description: 'Alarm interrupt' },
    ],
    programming: [
      'Write TIME and DATE.',
      'Write ALARM and enable the alarm interrupt in CTRL.',
      'Enable the counter.',
      'On an alarm, clear the flag in STATUS by writing 1.',
    ],
  },
  {
    slug: 'ttc',
    name: 'TTC',
    fullName: 'Triple Timer Counter',
    summary: 'Three independent timers for scheduling, capture and waveform output.',
    version: 'r2p0',
    overview: [
      'The TTC holds three 16-bit counters, each with its own prescaler, match registers and interrupt. A counter can run free, count to an interval or wrap on a match.',
      'Each counter can also generate a waveform or capture an external pulse, which makes it a general-purpose timing block.',
    ],
    features: [
      'Three independent 16-bit counters',
      'Interval and match modes',
      'Prescaler up to /65536',
      'External clock and pulse-capture input',
    ],
    registers: [
      { name: 'CLK_CTRL[n]', offset: '0x00 + n*0x04', access: 'RW', reset: '0x00000000', description: 'Clock source and prescaler for counter n' },
      { name: 'CNT_CTRL[n]', offset: '0x0C + n*0x04', access: 'RW', reset: '0x00000021', description: 'Mode, direction and enable' },
      { name: 'COUNT[n]', offset: '0x18 + n*0x04', access: 'RO', reset: '0x00000000', description: 'Current count value' },
      { name: 'INTERVAL[n]', offset: '0x24 + n*0x04', access: 'RW', reset: '0x00000000', description: 'Interval value' },
      { name: 'ISR', offset: '0x54', access: 'W1C', reset: '0x00000000', description: 'Interrupt status' },
    ],
    signals: [
      { name: 'clk_ext[2:0]', direction: 'in', description: 'External clock or capture pulse' },
      { name: 'wave_out[2:0]', direction: 'out', description: 'Waveform outputs' },
      { name: 'irq[2:0]', direction: 'out', description: 'Interrupt, one per counter' },
    ],
    programming: [
      'Pick a clock source and prescaler in CLK_CTRL.',
      'Write INTERVAL and select interval mode in CNT_CTRL.',
      'Enable the counter and unmask its interrupt.',
      'Acknowledge the interrupt by writing 1 to ISR.',
    ],
  },
  {
    slug: 'wdt',
    name: 'WDT',
    fullName: 'Watchdog Timer',
    summary: 'Resets the system when software stops servicing it.',
    version: 'r1p4',
    overview: [
      'The watchdog counts down from a programmed timeout. Software must restart the counter before it reaches zero, otherwise the block asserts a reset or an interrupt.',
      'A key sequence protects the restart register. This stops a runaway program from refreshing the watchdog by accident.',
    ],
    features: [
      'Programmable timeout',
      'Reset or interrupt-first action',
      'Key-protected restart register',
      'Lock bit that stops the watchdog being disabled',
    ],
    registers: [
      { name: 'CTRL', offset: '0x00', access: 'RW', reset: '0x00000000', description: 'Enable, action and lock' },
      { name: 'TIMEOUT', offset: '0x04', access: 'RW', reset: '0x0000FFFF', description: 'Timeout reload value' },
      { name: 'RESTART', offset: '0x08', access: 'WO', reset: '0x00000000', description: 'Write the restart key to reload the counter' },
      { name: 'STATUS', offset: '0x0C', access: 'W1C', reset: '0x00000000', description: 'Timeout and early-warning flags' },
    ],
    signals: [
      { name: 'wdt_rst_n', direction: 'out', description: 'System reset request, active low' },
      { name: 'irq', direction: 'out', description: 'Early-warning interrupt' },
    ],
    programming: [
      'Write TIMEOUT.',
      'Select the reset action and enable the block in CTRL.',
      'Write the restart key to RESTART at an interval shorter than the timeout.',
      'Set the lock bit once the configuration is final.',
    ],
  },
  {
    slug: 'sd4',
    name: 'SD4',
    fullName: 'SD Host Controller 4',
    summary: 'SD card host for removable storage.',
    version: 'r1p0',
    overview: [
      'The SD host controller drives an SD card over a one-bit or four-bit bus. It issues commands, moves data blocks and reports the card status.',
      'The controller has its own descriptor-based DMA engine and detects card insertion and removal. Confirm the supported host specification revision before publishing.',
    ],
    features: [
      'One-bit and four-bit data bus',
      'Default speed and high speed modes',
      'Descriptor-based DMA',
      'Card detect and write-protect inputs',
    ],
    registers: [
      { name: 'ARG', offset: '0x00', access: 'RW', reset: '0x00000000', description: 'Command argument' },
      { name: 'CMD', offset: '0x04', access: 'RW', reset: '0x00000000', description: 'Command index and response type. A write starts the command' },
      { name: 'RESP[n]', offset: '0x10 + n*0x04', access: 'RO', reset: '0x00000000', description: 'Command response words' },
      { name: 'CLK_CTRL', offset: '0x2C', access: 'RW', reset: '0x00000000', description: 'Clock divider and enable' },
      { name: 'INT_STATUS', offset: '0x30', access: 'W1C', reset: '0x00000000', description: 'Command, transfer and card-detect flags' },
    ],
    signals: [
      { name: 'sd_clk', direction: 'out', description: 'Card clock' },
      { name: 'sd_cmd', direction: 'inout', description: 'Command line' },
      { name: 'sd_dat[3:0]', direction: 'inout', description: 'Data lines' },
      { name: 'sd_cd_n', direction: 'in', description: 'Card detect, active low' },
      { name: 'irq', direction: 'out', description: 'Command, transfer or card interrupt' },
    ],
    programming: [
      'Enable the card clock in CLK_CTRL at 400 kHz.',
      'Run the card initialisation commands through ARG and CMD.',
      'Raise the clock and switch to the four-bit bus.',
      'Transfer blocks with the DMA descriptors and wait for INT_STATUS.',
    ],
  },
  {
    slug: 'sd6-emmc',
    name: 'SD6/eMMC',
    fullName: 'SD Host Controller 6 / eMMC',
    summary: 'High-speed host for UHS SD cards and on-board eMMC storage.',
    version: 'r1p0',
    overview: [
      'This controller serves both UHS-class SD cards and eMMC devices. It supports a wider bus and faster signalling than SD4, with tuning to align the sampling point.',
      'Boot partition access and a command queue are provided for eMMC. Confirm the supported SD and eMMC revisions before publishing.',
    ],
    features: [
      'One-bit, four-bit and eight-bit data bus',
      'UHS-I SD modes and HS200 or HS400 eMMC modes',
      'Sampling-point tuning',
      'Command queue and boot partition access',
    ],
    registers: [
      { name: 'ARG', offset: '0x00', access: 'RW', reset: '0x00000000', description: 'Command argument' },
      { name: 'CMD', offset: '0x04', access: 'RW', reset: '0x00000000', description: 'Command index and response type. A write starts the command' },
      { name: 'BUS_CTRL', offset: '0x28', access: 'RW', reset: '0x00000000', description: 'Bus width and signalling mode' },
      { name: 'TUNE', offset: '0x3C', access: 'RW', reset: '0x00000000', description: 'Tuning control and sampling point' },
      { name: 'INT_STATUS', offset: '0x30', access: 'W1C', reset: '0x00000000', description: 'Command, transfer and error flags' },
    ],
    signals: [
      { name: 'clk', direction: 'out', description: 'Device clock' },
      { name: 'cmd', direction: 'inout', description: 'Command line' },
      { name: 'dat[7:0]', direction: 'inout', description: 'Data lines' },
      { name: 'strobe', direction: 'in', description: 'Data strobe for HS400' },
      { name: 'rst_n', direction: 'out', description: 'Device reset, active low' },
      { name: 'irq', direction: 'out', description: 'Command, transfer or error interrupt' },
    ],
    programming: [
      'Reset the device and initialise it with CMD and ARG.',
      'Select the bus width and signalling mode in BUS_CTRL.',
      'Run the tuning procedure through TUNE for the fast modes.',
      'Transfer data with DMA and check INT_STATUS for completion.',
    ],
  },
  {
    slug: 'gpio',
    name: 'GPIO',
    fullName: 'General-Purpose Input/Output',
    summary: 'Pin-level control and sensing with per-pin interrupts.',
    version: 'r1p2',
    overview: [
      'The GPIO block exposes 32 pins as individually controllable inputs or outputs. Each pin can raise an interrupt on a level or an edge.',
      'Set, clear and toggle registers let software change single pins without a read-modify-write cycle.',
    ],
    features: [
      '32 pins with per-pin direction',
      'Atomic set, clear and toggle registers',
      'Level and edge interrupts',
      'Input synchroniser and optional debounce',
    ],
    registers: [
      { name: 'DIR', offset: '0x00', access: 'RW', reset: '0x00000000', description: 'Direction, 1 is output' },
      { name: 'DATA_IN', offset: '0x04', access: 'RO', reset: '0x00000000', description: 'Synchronised pin state' },
      { name: 'DATA_OUT', offset: '0x08', access: 'RW', reset: '0x00000000', description: 'Output value' },
      { name: 'INT_TYPE', offset: '0x10', access: 'RW', reset: '0x00000000', description: 'Level or edge, and polarity' },
      { name: 'INT_STATUS', offset: '0x14', access: 'W1C', reset: '0x00000000', description: 'Pending pin interrupts' },
    ],
    signals: [
      { name: 'gpio[31:0]', direction: 'inout', description: 'Pins' },
      { name: 'irq', direction: 'out', description: 'Combined pin interrupt' },
    ],
    programming: [
      'Set the direction of each pin in DIR.',
      'Write DATA_OUT for outputs, or read DATA_IN for inputs.',
      'For interrupts, choose the trigger in INT_TYPE and unmask the pin.',
      'In the handler, read INT_STATUS and clear it by writing 1.',
    ],
  },
];

export function findIp(slug: string | undefined): IpDoc | undefined {
  return ips.find((ip) => ip.slug === slug);
}
