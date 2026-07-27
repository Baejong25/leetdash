class Solution {
    public int solution(int angle) {
        int result = 0; 
        if (angle == 180) {
            result = 4; 
        } else if (angle < 180 && angle > 90) {
            result = 3;
        } else if (angle ==90) {
            result = 2; 
        } else if (angle > 0 && angle < 90) {
            result = 1;
        }
        return result;
    }
}