import { Readable } from 'node:stream'

export const getTestInputStream = (): Readable => {
  return Readable.from(
    [
      '0x8cfd118c74bfaece63c8229a169402a5d54f9a3d,150.5',
      '0xe052113bd7d7700d623414a0a4585bcae754e9d5,143.0',
      '0x17e31bf839acb700e0f584797574a2c1fde46d0b,140.5',
      '0xf7b18e107eb36797f4ce36de756630b9c30969ad,133.0',
      '0x61d0ea212b35721e021f56094603165a92410c19,132.5',
      '0xaf469c4a0914938e6149cf621c54fb4b1ec0c202,128.0',
      '0x7ef61cacd0c785eacdfe17649d1c5bcba676a858,126.5',
      '0xe01a97fc4607a388a41626d5e039fdecbfc6acd9,126.5',
      '0x20335c504a4f0d8db934e9f77a67b55e6ae8e1e1,123.0',
      '0x5b93ff82faaf241c15997ea3975419dddd8362c5,122.0',
      '0xab6ca2017548a170699890214bfd66583a0c1754,121.0',
      '0x967edc401472dc8b7dc3b9e51bc66bd6477ee209,121.0',
      '0x26013b787aac632a92483f669e2de85103ad2536,119.0'
    ].map((item) => `${item}\n`)
  )
}
