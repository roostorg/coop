import CollectionIcon from '../../../icons/CollectionIcon';
import ContentIcon from '../../../icons/ContentIcon';
import UserIcon from '../../../icons/UserIcon';
import CollectionItemTypeWireframe from '../../../images/CollectionItemTypeWireframe.png';
import ContentItemTypeWireframe from '../../../images/ContentItemTypeWireframe.png';
import UserItemTypeWireframe from '../../../images/UserItemTypeWireframe.png';

export default function ItemTypesExplainer() {
  return (
    <div className="flex flex-col">
      <table className="text-start border-spacing">
        <tr>
          <td className="pt-2 align-top">
            <UserIcon width="22px" />
          </td>
          <td>
            <div className="my-2 ml-4">
              <b>User</b>: An account or profile on your platform. You may just
              have one user type, but you may have more. For example, a
              marketplaces might have buyers and sellers as different types of
              users, a ride-sharing app might have drivers and passengers as
              different types of users, etc.
            </div>
          </td>
        </tr>
        <tr>
          <td className="pt-2 align-top">
            <ContentIcon width="22px" />
          </td>
          <td>
            <div className="my-2 ml-4">
              <b>Content</b>: An individual item that a user on your platform
              can create. Examples include messages, comments, posts, product
              listings, reviews, etc. A Content Item Type can refer to a User
              Item Type as its creator.
            </div>
          </td>
        </tr>
        <tr>
          <td className="pt-2 align-top">
            <CollectionIcon width="22px" />
          </td>
          <td>
            <div className="my-2 ml-4">
              <b>Thread</b>: Anything that contains multiple pieces of Content
              in order. For example, a chat thread is a thread of messages,
              where message is a Content Type. A comment thread is a thread of
              comments, where comment is a Content Type. Something like a
              Facebook Group would be a thread of Posts, where post is a Content
              Type.
            </div>
          </td>
        </tr>
      </table>
      <div className="flex flex-row px-48 mt-4 gap-10">
        <div className="flex flex-col items-start gap-2">
          <div className="font-bold">User</div>
          <img
            className="w-full"
            src={UserItemTypeWireframe}
            alt="User Item Type Wireframe"
          />
        </div>
        <div className="flex flex-col items-start gap-2">
          <div className="font-bold">Content</div>
          <img
            className="w-full"
            src={ContentItemTypeWireframe}
            alt="Content Item Type Wireframe"
          />
        </div>
        <div className="flex flex-col items-start gap-2">
          <div className="font-bold">Thread</div>
          <img
            className="max-w-full h-3/4"
            src={CollectionItemTypeWireframe}
            alt="Thread Item Type Wireframe"
          />
        </div>
      </div>
    </div>
  );
}
