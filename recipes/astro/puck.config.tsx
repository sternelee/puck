import type { Config } from "@puckeditor/core";

type Props = {
  HeadingBlock: { title: string };
  TextBlock: { text: string };
  ColumnsBlock: { columns: { title: string; text: string }[] };
};

export const config: Config<Props> = {
  components: {
    HeadingBlock: {
      fields: {
        title: { type: "text" },
      },
      defaultProps: {
        title: "Heading",
      },
      render: ({ title }) => (
        <div style={{ padding: "32px 0" }}>
          <h1>{title}</h1>
        </div>
      ),
    },
    TextBlock: {
      fields: {
        text: { type: "text" },
      },
      defaultProps: {
        text: "Text",
      },
      render: ({ text }) => (
        <div style={{ padding: "16px 0" }}>
          <p>{text}</p>
        </div>
      ),
    },
    ColumnsBlock: {
      fields: {
        columns: {
          type: "array",
          arrayFields: {
            title: { type: "text" },
            text: { type: "text" },
          },
        },
      },
      defaultProps: {
        columns: [{ title: "Column 1", text: "Content" }],
      },
      render: ({ columns }) => (
        <div
          style={{
            display: "flex",
            gap: "16px",
            padding: "16px 0",
          }}
        >
          {columns?.map((column, index) => (
            <div
              key={index}
              style={{
                flex: 1,
                padding: "16px",
                border: "1px solid #ccc",
                borderRadius: "8px",
              }}
            >
              <h3>{column.title}</h3>
              <p>{column.text}</p>
            </div>
          ))}
        </div>
      ),
    },
  },
};

export default config;
