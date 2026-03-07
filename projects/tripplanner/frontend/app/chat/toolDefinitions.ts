export const chatTools = [
  {
    type: "function" as const,
    function: {
      name: "create_segment",
      description: "Create a new travel segment (flight, train, bus, accommodation, activity, etc.)",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Segment name, e.g. 'BUD-OSL Flight'" },
          segmentTypeName: { type: "string", description: "Type name, e.g. 'Flight', 'Train', 'Accommodation'" },
          startDateTime: { type: "string", description: "Start date/time in ISO 8601 format (local time)" },
          endDateTime: { type: "string", description: "End date/time in ISO 8601 format (local time)" },
          startUtcOffset: { type: "number", description: "UTC offset in hours for start time (e.g. 1 for CET)" },
          endUtcOffset: { type: "number", description: "UTC offset in hours for end time" },
          cost: { type: "number", description: "Cost amount" },
          currencyShortName: { type: "string", description: "Currency code, e.g. 'EUR', 'USD', 'NOK'" },
          comment: { type: "string", description: "Optional comment" },
          startLocationName: { type: "string", description: "Start location name for geocoding, e.g. 'Budapest'" },
          endLocationName: { type: "string", description: "End location name for geocoding, e.g. 'Oslo'" },
        },
        required: ["name", "segmentTypeName"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_segment",
      description: "Update an existing segment. Only provide fields you want to change.",
      parameters: {
        type: "object",
        properties: {
          segmentId: { type: "number", description: "The segment ID to update" },
          name: { type: "string" },
          segmentTypeName: { type: "string" },
          startDateTime: { type: "string" },
          endDateTime: { type: "string" },
          startUtcOffset: { type: "number" },
          endUtcOffset: { type: "number" },
          cost: { type: "number" },
          currencyShortName: { type: "string" },
          comment: { type: "string" },
          startLocationName: { type: "string" },
          endLocationName: { type: "string" },
        },
        required: ["segmentId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_segment",
      description: "Delete a segment by ID",
      parameters: {
        type: "object",
        properties: {
          segmentId: { type: "number", description: "The segment ID to delete" },
        },
        required: ["segmentId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_option",
      description: "Create a new option (route/itinerary grouping)",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Option name, e.g. 'Route A'" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_option",
      description: "Update an existing option",
      parameters: {
        type: "object",
        properties: {
          optionId: { type: "number", description: "The option ID to update" },
          name: { type: "string", description: "New name" },
        },
        required: ["optionId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_option",
      description: "Delete an option by ID",
      parameters: {
        type: "object",
        properties: {
          optionId: { type: "number", description: "The option ID to delete" },
        },
        required: ["optionId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "connect_segments_to_option",
      description: "Connect one or more segments to an option. This replaces the option's current segment connections.",
      parameters: {
        type: "object",
        properties: {
          optionId: { type: "number", description: "The option ID" },
          segmentIds: {
            type: "array",
            items: { type: "number" },
            description: "Array of segment IDs to connect",
          },
        },
        required: ["optionId", "segmentIds"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_segments",
      description: "List all segments in the current trip with their details",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_options",
      description: "List all options in the current trip with their details",
      parameters: { type: "object", properties: {} },
    },
  },
]
