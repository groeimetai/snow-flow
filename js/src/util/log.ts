export namespace Log {
  export function create(tags?: Record<string, any>) {
    tags = tags || {};

    const result = {
      info(message?: any, extra?: Record<string, any>) {
        const prefix = Object.entries({
          ...tags,
          ...extra,
        })
          .map(([key, value]) => `${key}=${value}`)
          .join(" ");
        console.log(prefix, message);
        return result;
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
