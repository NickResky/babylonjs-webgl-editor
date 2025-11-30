import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'cameraFilter'
})
export class CameraFilterPipe implements PipeTransform {
  
  transform(cameras: any, stringQuery?: string, category?: string ): any {
      if(!cameras)return null;
      if(!stringQuery && !category) return cameras;

      stringQuery = stringQuery.toLowerCase();

      return   cameras.filter((camera) => {
        if (category && stringQuery) {
          return camera.category === category && camera.id.toLowerCase().includes(stringQuery);
        }
        if (category && !stringQuery) {
          return camera.category === category;
        }
        if (!category && stringQuery) {
          return camera.id.toLowerCase().includes(stringQuery);
        } 
      }).map(camera => {
        var re = new RegExp(stringQuery, 'gi'); //'gi' for case insensitive and can use 'g' if you want the search to be case sensitive.
        return {
          ...camera,
          label: camera.id.replace(re, "<mark>$&</mark>")
        } 
      });
  }

}