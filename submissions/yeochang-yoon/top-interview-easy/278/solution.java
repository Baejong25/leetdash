/* The isBadVersion API is defined in the parent class VersionControl.
      boolean isBadVersion(int version); */

public class Solution extends VersionControl {
    public int firstBadVersion(int n) {
        return search(1, n);
    }

    public int search(int left, int right){

        if(left == right){
            return left;
        }

        int mid = left + (right - left) / 2;

        if(isBadVersion(mid)){
            return search(left, mid);
        } else{
            return search(mid + 1, right);
        }
    }
}


