import * as React from 'react';

import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type NativeSelectProps = Omit<
  React.ComponentPropsWithoutRef<typeof SelectTrigger>,
  'children' | 'size'
> & {
  children?: React.ReactNode;
  name?: string;
  value?: string | null;
  defaultValue?: string | null;
  required?: boolean;
  disabled?: boolean;
  form?: string;
  size?: 'sm' | 'default';
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  onValueChange?: (value: string | null) => void;
};

type NativeSelectOptionProps = Omit<
  React.ComponentPropsWithoutRef<typeof SelectItem>,
  'children' | 'className' | 'label' | 'value'
> & {
  children?: React.ReactNode;
  className?: string;
  label?: string;
  value?: string;
};

function optionText(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : ''))
    .join('')
    .trim();
}

function optionValue(value: string | undefined, children: React.ReactNode): string | null {
  if (value === '') return null;
  if (value !== undefined && value !== null) return String(value);
  return optionText(children);
}

function selectValue(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === '') return null;
  return value;
}

function NativeSelect({
  className,
  size = 'default',
  children,
  value,
  defaultValue,
  onChange,
  onValueChange,
  name,
  required,
  disabled,
  id,
  form,
  ...props
}: NativeSelectProps) {
  const options = React.Children.toArray(children).filter(
    (child): child is React.ReactElement<NativeSelectOptionProps> =>
      React.isValidElement(child) && child.type === NativeSelectOption,
  );
  const items = options.map((child) => ({
    value: optionValue(child.props.value, child.props.children),
    label: child.props.children,
  }));
  const firstValue = items[0]?.value;
  const controlledValue = selectValue(value);
  const initialValue = defaultValue === undefined ? firstValue : selectValue(defaultValue);

  function handleValueChange(nextValue: string | null) {
    onValueChange?.(nextValue);
    if (onChange) {
      const event = {
        target: { value: nextValue ?? '' },
        currentTarget: { value: nextValue ?? '' },
      } as React.ChangeEvent<HTMLSelectElement>;
      onChange(event);
    }
  }

  return (
    <Select
      items={items}
      name={name}
      value={controlledValue}
      defaultValue={initialValue}
      onValueChange={handleValueChange}
      required={required}
      disabled={disabled}
      form={form}
      data-size={size}
    >
      <div
        className={cn(
          'group/native-select relative w-fit data-disabled:pointer-events-none data-disabled:opacity-50',
          className,
        )}
        data-disabled={disabled || undefined}
        data-size={size}
      >
        <SelectTrigger id={id} size={size} {...props}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false}>
          {children}
        </SelectContent>
      </div>
    </Select>
  );
}

function NativeSelectOption({
  className,
  value,
  children,
  ...props
}: NativeSelectOptionProps) {
  return (
    <SelectItem
      value={optionValue(value, children)}
      className={cn('text-popover-foreground', className)}
      {...props}
    >
      {children}
    </SelectItem>
  );
}

function NativeSelectOptGroup({
  className,
  label,
  children,
  ...props
}: {
  className?: string;
  label?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<typeof SelectGroup>, 'children' | 'className'>) {
  return (
    <SelectGroup className={className} {...props}>
      {label ? <SelectLabel>{label}</SelectLabel> : null}
      {children}
    </SelectGroup>
  );
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
