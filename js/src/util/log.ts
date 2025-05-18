export namespace Log {
  export function create(tags?: Record<string, any>) {
    tags = tags || {};

    function build(message: any, extra?: Record<string, any>) {
      const prefix = Object.entries({
        ...tags,
        ...extra,
      })
        .map(([key, value]) => `${key}=${value}`)
        .join(" ");
      return [prefix, message];
    }
    const result = {
      info(message?: any, extra?: Record<string, any>) {
        console.log(...build(message, extra));
      },
      error(message?: any, extra?: Record<string, any>) {
        console.error(...build(message, extra));
      },
      tag(key: string, value: string) {
        if (tags) tags[key] = value;
        return result;
      },
      clone() {
        return Log.create({ ...tags });
      },
    };

    return result;
  }
}
