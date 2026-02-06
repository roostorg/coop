export class TestDateProvider {
  private date: Date;

  constructor() {
    this.date = new Date();
  }

  public getDate(): Date {
    return this.date;
  }

  public advanceTimeByMs(ms: number): void {
    this.date = new Date(this.date.getTime() + ms);
  }
}
