import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'includes'
})
export class IncludesPipe implements PipeTransform {

  transform(value: string, array: string[]): unknown {
    return !!array.includes(value);
  }

}
