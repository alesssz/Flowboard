// A label's name and colour, in a card's labels panel: a new label, or one of the board's with Delete label.
// The colour is part of the draft, saved with the name; saves wait for the API.
import { type Label, labelNameMaxLength, type PaletteColor, paletteColors } from '@flowboard/shared';
import { type FormEvent, type KeyboardEvent, useId, useState } from 'react';
import { ConfirmDelete, SaveState } from './FieldControls.tsx';
import { useCreateLabel, useDeleteLabel, useUpdateLabel } from './label-mutations.ts';
import './LabelEditor.css';

interface LabelEditorProps {
  boardId: string;
  /** Every label of the board: names already taken, and the colour a new label starts with. */
  labels: Label[];
  /** The label to change; null creates one. */
  label: Label | null;
  /** How many cards have the label, named before deleting it. */
  cardCount: number;
  onCreated: (label: Label) => void;
  /** After Save, Cancel, Escape or Delete; `deleted` when the label is gone. */
  onClose: (deleted: boolean) => void;
}

export function LabelEditor({ boardId, labels, label, cardCount, onCreated, onClose }: LabelEditorProps) {
  const headingId = useId();
  const nameId = useId();
  const colorName = useId();
  const [name, setName] = useState(label?.name ?? '');
  const [color, setColor] = useState<PaletteColor>(label?.color ?? nextColor(labels));
  const [taken, setTaken] = useState(false);
  const create = useCreateLabel(boardId);
  const update = useUpdateLabel(boardId);
  const remove = useDeleteLabel(boardId);
  const pending = create.isPending || update.isPending || remove.isPending;
  const trimmed = name.trim();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || trimmed === '') return;
    // The API refuses it too (409); this saves the round trip.
    if (labels.some((other) => other.id !== label?.id && other.name.toLowerCase() === trimmed.toLowerCase())) {
      setTaken(true);
      return;
    }
    if (label === null) {
      create.mutate({ name: trimmed, color }, { onSuccess: onCreated });
      return;
    }
    if (trimmed === label.name && color === label.color) {
      onClose(false);
      return;
    }
    update.mutate(
      { labelId: label.id, changes: { name: trimmed === label.name ? undefined : trimmed, color: color === label.color ? undefined : color } },
      { onSuccess: () => onClose(false) },
    );
  }

  function handleCancel() {
    if (!pending) onClose(false);
  }

  // The confirmation handles its own Escape first.
  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    // Keeps the panel around the editor open.
    event.preventDefault();
    handleCancel();
  }

  function handleDelete() {
    if (label !== null) remove.mutate(label.id, { onSuccess: () => onClose(true) });
  }

  return (
    <form className="label-editor" aria-labelledby={headingId} onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
      <div className="label-editor__top">
        <h3 id={headingId} className="label-editor__heading">
          {label === null ? 'Create label' : 'Edit label'}
        </h3>
        {/* What the cards will show; the fields below say the same to screen readers. */}
        <span className="label-editor__preview" data-color={color} aria-hidden="true">
          {trimmed === '' ? 'Label' : trimmed}
        </span>
      </div>

      <label htmlFor={nameId} className="label-editor__legend">
        Name
      </label>
      <input
        id={nameId}
        className="label-editor__input"
        value={name}
        maxLength={labelNameMaxLength}
        readOnly={pending}
        autoFocus
        aria-invalid={taken || undefined}
        aria-describedby={taken ? `${nameId}-taken` : undefined}
        onChange={(event) => {
          setName(event.target.value);
          setTaken(false);
        }}
      />
      {taken && (
        <p id={`${nameId}-taken`} className="label-editor__error" role="alert">
          The board already has a label with this name.
        </p>
      )}

      <fieldset className="label-editor__colors">
        <legend className="label-editor__legend">Colour</legend>
        <div className="label-editor__swatches">
          {paletteColors.map((option) => (
            <input
              key={option}
              type="radio"
              className="label-editor__swatch"
              data-color={option}
              name={colorName}
              value={option}
              aria-label={option.charAt(0).toUpperCase() + option.slice(1)}
              checked={option === color}
              onChange={() => setColor(option)}
            />
          ))}
        </div>
      </fieldset>

      <div className="field-control__actions">
        <button
          type="submit"
          className="field-control__button field-control__button--primary"
          aria-disabled={pending || trimmed === ''}
        >
          {create.isPending || update.isPending ? 'Saving…' : label === null ? 'Create' : 'Save'}
        </button>
        <button type="button" className="field-control__button" aria-disabled={pending} onClick={handleCancel}>
          Cancel
        </button>
        <SaveState pending={false} error={create.error ?? update.error} />
      </div>

      {label !== null && (
        <div className="label-editor__delete">
          <ConfirmDelete
            label="Delete label"
            question={
              cardCount === 0
                ? 'Delete this label?'
                : `Delete this label from the board and from the ${cardCount === 1 ? 'card that has it' : `${cardCount} cards that have it`}?`
            }
            pending={remove.isPending}
            error={remove.error}
            onDelete={handleDelete}
            onCancel={remove.reset}
          />
        </div>
      )}
    </form>
  );
}

// The first palette colour no label has, gray (the neutral one) aside; gray once every other is taken.
function nextColor(labels: Label[]): PaletteColor {
  const used = new Set(labels.map((label) => label.color));
  return paletteColors.find((color) => color !== 'gray' && !used.has(color)) ?? 'gray';
}
