import { describe, expect, it } from 'vitest';

import { parseSriLankanNicOcrText } from './nic-ocr.js';

describe('parseSriLankanNicOcrText', () => {
  it('extracts a new-format Sri Lankan NIC number', () => {
    expect(
      parseSriLankanNicOcrText('NATIONAL IDENTITY CARD\nNIC: 199012012345'),
    ).toMatchObject({
      nicNumber: '199012012345',
    });
  });

  it('extracts an old-format NIC ending in V', () => {
    expect(
      parseSriLankanNicOcrText('NIC NO: 901234567V'),
    ).toMatchObject({
      nicNumber: '901234567V',
    });
  });

  it('normalizes a lowercase old-format NIC suffix', () => {
    expect(
      parseSriLankanNicOcrText('NIC NO: 901234567v').nicNumber,
    ).toBe('901234567V');
  });

  it('derives the date of birth from a valid new-format NIC date code', () => {
    expect(
      parseSriLankanNicOcrText('NIC: 199012012345').dateOfBirth,
    ).toBe('1990-04-30');
  });

  it('derives the date of birth from a valid old-format NIC date code', () => {
    expect(
      parseSriLankanNicOcrText('NIC: 900123456V').dateOfBirth,
    ).toBe('1990-01-12');
  });

  it('extracts an explicitly printed date of birth when available', () => {
    expect(
      parseSriLankanNicOcrText('Date of Birth: 12/01/1990').dateOfBirth,
    ).toBe('1990-01-12');
  });

  it('does not invent a NIC number when the text has no valid NIC candidate', () => {
    expect(
      parseSriLankanNicOcrText('NATIONAL IDENTITY CARD\nNo readable number'),
    ).toMatchObject({
      nicNumber: null,
      dateOfBirth: null,
    });
  });

  it('does not derive a date from an invalid NIC day code', () => {
    expect(
      parseSriLankanNicOcrText('NIC: 199000012345').dateOfBirth,
    ).toBeNull();
  });

  it('does not treat an unrelated long number as a NIC number', () => {
    expect(
      parseSriLankanNicOcrText('Reference: 1234567890123456').nicNumber,
    ).toBeNull();
  });

  it('returns null for an unrecognized date', () => {
    expect(
      parseSriLankanNicOcrText('Date of Birth: 39/19/1990').dateOfBirth,
    ).toBeNull();
  });

  it('handles a name label without a colon', () => {
    expect(
      parseSriLankanNicOcrText(
        'NATIONAL IDENTITY CARD\nNAME\nKUMAR SILVA',
      ).fullName,
    ).toBe('KUMAR SILVA');
  });

  it('handles a name value on the line after its label', () => {
    expect(
      parseSriLankanNicOcrText(
        'NAME IN FULL\nKUMAR SILVA\nDATE OF BIRTH: 12/01/1990',
      ).fullName,
    ).toBe('KUMAR SILVA');
  });

  it('handles a name label fragmented across OCR lines', () => {
    expect(
      parseSriLankanNicOcrText(
        'NAME :\name: SAMPLE PERSON\nDATE OF BIRTH: 2000/04/15',
      ).fullName,
    ).toBe('SAMPLE PERSON');
  });

  it('does not infer a legal name from unrelated text', () => {
    expect(
      parseSriLankanNicOcrText(
        'NATIONAL IDENTITY CARD\nCOLOMBO\nSRI LANKA',
      ).fullName,
    ).toBeNull();
  });

  it('rejects a NIC date code that is impossible for its year', () => {
    expect(
      parseSriLankanNicOcrText('NIC: 199036612345').nicNumber,
    ).toBeNull();
  });

});