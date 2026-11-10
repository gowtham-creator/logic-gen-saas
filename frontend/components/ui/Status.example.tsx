import React from 'react';
import Status from './Status';

/**
 * Example usage of the Status component in a table
 */
export function StatusExample() {
  return (
    <div className="p-8 space-y-4">
      <h2 className="text-2xl font-bold mb-4">Status Component Examples</h2>

      <div className="space-y-2">
        <div className="flex items-center gap-4">
          <span className="w-24 text-gray-600">Active:</span>
          <Status status="active" />
        </div>

        <div className="flex items-center gap-4">
          <span className="w-24 text-gray-600">Inactive:</span>
          <Status status="inactive" />
        </div>

        <div className="flex items-center gap-4">
          <span className="w-24 text-gray-600">Expired:</span>
          <Status status="expired" />
        </div>
      </div>

      <h3 className="text-xl font-semibold mt-8 mb-4">In a Table</h3>
      <div className="border rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                John Doe
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                john@example.com
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <Status status="active" />
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                Jane Smith
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                jane@example.com
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <Status status="inactive" />
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                Bob Johnson
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                bob@example.com
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <Status status="expired" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default StatusExample;
