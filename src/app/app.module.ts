import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
// No need to declare FacetedSearchComponent here

@NgModule({
  declarations: [AppComponent], // Only declare AppComponent
  imports: [BrowserModule], // Add necessary modules
  bootstrap: [AppComponent],
})
export class AppModule {}
