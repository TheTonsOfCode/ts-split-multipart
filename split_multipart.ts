    public splitArrayBufferMultipart(buffer: Uint8Array, boundary: string) {
      const CARRIAGE_RETURN = 13;
      const ENTER = 10;

      const byteA = buffer[0];
      const byteB = buffer[1];

      // Windows 13,10
      // Linux   10
      // Mac     13
      const breaks = [
        [CARRIAGE_RETURN, ENTER],
        [ENTER],
        [CARRIAGE_RETURN]
      ][
        byteA == CARRIAGE_RETURN && byteB == ENTER ? 0 : byteA == ENTER ? 1 : 2
        ];

      const blen = boundary.length;

      const barr = new Uint8Array(blen);
      for (let i = 0; i < blen; i++) {
        barr[i] = boundary.charCodeAt(i);
      }

      class HeaderProp {
        constructor(
          public name: string,
          public value: string
        ) {
        }
      }

      class BoundaryHolder {
        public header: Array<HeaderProp> = [];
        public type: string = '';
        public length: number = -1;
        public buffer: Uint8Array = new Uint8Array();

        public get data(): any {
          if(this.type === 'application/json') {
            return this.json();
          }
          if(this.type === 'text/html' || this.type === 'text/plain') {
            return this.text();
          }
          return buffer;
        }

        public text() {
          let str = '';
          for (let i = 0; i < this.length; i++) {
            str += String.fromCharCode(this.buffer[i]);
          }
          return str;
        }

        public json() {
          return JSON.parse(this.text());
        }
      }

      let holder: BoundaryHolder | null = null;
      let readHolderHeader = false;
      let readHolderFirstBreak = false;

      let ri: number = 0;
      let read: Array<number> = [];

      function resetRead() {
        ri = 0;
        read = [];
      }

      resetRead();

      function readToString() {
        let str = '';
        for (let i = 0; i < ri; i++) {
          str += String.fromCharCode(read[i]);
        }
        return str;
      }

      function finishBoundary() {
        if (holder) {
          if (holder.length && holder.length != -1 && holder.length != read.length) {
            console.error("Mistake in algorithm! Difference at content length!")
          }

          holder.buffer = new Uint8Array(read);

          if(holder.length == -1) {
            holder.length = holder.buffer.length;
          }

          holders.push(holder);
          pushedHolder = true;
        }

        holder = null;
      }

      function loopActionDataRead(i) {
        resetChkBoundary(i, false);
        read[ri++] = buffer[i];

        if(holder && holder.length) {
          if(holder.length == ri) {
            finishBoundary();
          }
        }
      }

      function loopActionChkBoundary(i) {
        if (chkBoundaryIndex == 0) {
          chkBoundaryStartIndex = i;
        }

        chkBoundaryIndex++;

        if (chkBoundaryIndex == blen) {
          finishBoundary();

          holder = new BoundaryHolder();
          pushedHolder = false;
          readHolderHeader = true;
          readHolderFirstBreak = true;
          resetChkBoundary(i, true);
          resetRead();
        }
      }

      let chkBoundaryStartIndex: number = 0;
      let chkBoundaryIndex: number = 0;

      function resetChkBoundary(i, successFoundBoundary) {
        const prevChkBoundaryIndex = chkBoundaryIndex;
        chkBoundaryStartIndex = -1;
        chkBoundaryIndex = 0;
        if (!successFoundBoundary) {
          for (let back = 0; back < prevChkBoundaryIndex; back++) {
            loopActionDataRead(i - prevChkBoundaryIndex + back)
          }
        }
      }

      resetChkBoundary(0, false);

      let pushedHolder = true;
      let holders: Array<BoundaryHolder> = [];

      for (let i = 0; i < buffer.length; i++) {
        if (readHolderHeader) {
          let isBreak = true;
          for (let B = 0; B < breaks.length; B++) {
            if (buffer[i + B] != breaks[B]) {
              isBreak = false;
              break;
            }
          }

          if (isBreak) {
            if (breaks.length > 1) {
              i += breaks.length - 1;
            }

            if (!ri && readHolderFirstBreak) {
              readHolderFirstBreak = false;
              continue;
            }

            var headerLine = readToString();

            if (headerLine.length < 5) {
              readHolderHeader = false;
            } else {
              const headerPropSpl = headerLine.split(':');
              const prop = new HeaderProp(
                headerPropSpl[0].trim(),
                headerPropSpl[1].trim()
              );

              if (!holder) {
                throw new Error('Holder not set???');
              }

              holder.header.push(prop);

              const name = prop.name.toLocaleLowerCase();

              if (name == 'content-type') {
                // @ts-ignore
                holder.type = prop.value;
              } else if (name == 'content-length') {
                // @ts-ignore
                holder.length = +prop.value;
              }
            }
            resetRead();
          } else {
            read[ri++] = buffer[i];
            readHolderFirstBreak = false;
          }
        } else if (buffer[i] == barr[chkBoundaryIndex]) {
          loopActionChkBoundary(i)
        } else {
          loopActionDataRead(i);
        }
      }

      if (!pushedHolder) {
        finishBoundary();
      }

      return holders;
    }
